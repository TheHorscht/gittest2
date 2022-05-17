const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const core = require('@actions/core');
const github = require('@actions/github');
const minimatch = require("minimatch");
const commandLineArgs = require('command-line-args');
const options = commandLineArgs([
  { name: 'preview', alias: 'p', type: Boolean, defaultValue: false },
  { name: 'version', alias: 'v', type: String },
]);

if(!options.version) {
  core.error('Version argument is required');
}

//console.log(__dirname); // C:\gittest2\build
// Config
const out_dir = __dirname + '/dist';
const version = options.version;
// const root_folder = path.resolve(__dirname, '..', '..');
const root_folder = __dirname;
const ignore_list = [
  '**/node_modules',
  '**/.*',
  'www/*',
  '*.json',
  '*.js',
  'dist',
  'env.lua',
  '*.md',
  'unit_test.lua',
  'unit_tests.lua',
  'xxx.lua',
  'action',
  'build',
];
// Config end

const scriptName = path.basename(__filename);
ignore_list.push(scriptName);

function is_dir(path) {
  try {
    var stat = fs.lstatSync(path);
    return stat.isDirectory();
  } catch (e) {
    // lstatSync throws an error if path doesn't exist
    return false;
  }
}

const zip = new AdmZip();

const addFiles = item => {
  if(ignore_list.every(ignore_entry => !minimatch(item, ignore_entry))) {
    if(is_dir(root_folder + '/' + item)) {
      fs.readdirSync(root_folder + '/' + item).forEach(entry => {
        const child_item = `${item}/${entry}`;
        addFiles(child_item);
      });
    } else {
      const folderName = item.substr(0, item.lastIndexOf('/'));
      if(options.preview) {
        console.log(`${root_folder}/${item}`, `${github.context.repo.repo}/${folderName}`);
      } else {
        console.log(`Zipping: ${root_folder}/${item} into ${github.context.repo.repo}/${folderName}`);
        zip.addLocalFile(`${root_folder}/${item}`, `${github.context.repo.repo}/${folderName}`);
      }
    }
  }
};

fs.readdirSync(root_folder).forEach(entry => {
  addFiles(entry);
});

if(!options.preview) {
  if (!fs.existsSync(out_dir)) {
    fs.mkdirSync(out_dir);
  }
  zip.writeZip(`${out_dir}/${github.context.repo.repo}_v${version}.zip`);
}




if(options.preview) {
  process.exit(-1);
}



// Publish




const assert = require('assert');
const axios = require('axios').default;
const uriTemplate = require('uri-template');
const { Octokit } = require('@octokit/core');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const util = require('util');
fs.readFile = util.promisify(fs.readFile);

async function upload_release() {
  const folderName = path.basename(`../${__dirname}`);
  let changes;
  let version = `v${options.version}`;
  let changelog = 'New Update';
  // const filename = path.resolve(folderName, '../..', 'changelog.txt');
  const archiveName = `${folderName}_${version}.zip`;
  let result;
  result = await octokit.request('POST /repos/{owner}/{repo}/releases', {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    tag_name: version,
    name: version,
    body: changelog,
  });
  assert(result.status == 201);
  let file = await fs.readFile(path.resolve(__dirname, 'dist/', archiveName));
  let uri = uriTemplate.parse(result.data.upload_url);
  result = await axios.post(uri.expand({ name: archiveName, label: archiveName }), file, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/zip, application/octet-stream',
    },
  }).catch(err => {
    console.log(`${err.response.status} - ${err.response.statusText}`);
  });
}

upload_release();
