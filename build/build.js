const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const minimatch = require("minimatch");
const commandLineArgs = require('command-line-args');
// const pjson = require('../../package.json');
const pjson = {
  version: "1.3.0"
}
const options = commandLineArgs([
  { name: 'preview', alias: 'p', type: Boolean, defaultValue: false },
  { name: 'token', alias: 't', type: String, },
]);

// Config
const out_dir = __dirname + '/dist';
const name = path.basename(__dirname);
const version = pjson.version;
const root_folder = path.resolve(__dirname, '..', '..');
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
        console.log(`${root_folder}/${item}`, `${name}/${folderName}`);
      } else {
        console.log(`Zipping: ${root_folder}/${item} into ${name}/${folderName}`);
        zip.addLocalFile(`${root_folder}/${item}`, `${name}/${folderName}`);
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
  zip.writeZip(`${out_dir}/${name}_v${version}.zip`);
}




if(options.preview) {
  process.exit(-1);
}



// Publish




const assert = require('assert');
const axios = require('axios').default;
const uriTemplate = require('uri-template');
const { Octokit } = require('@octokit/core');
const octokit = new Octokit({ auth: options.token });
const util = require('util');
fs.readFile = util.promisify(fs.readFile);

// Read changelog.txt and pull the version and changes from it
async function readChangeLog(filename) {
  let changelogContents = await fs.readFile(filename);
  let out = [];
  let currentLine = { changes: [] };
  let lines = changelogContents.toString().split('\n');
  lines.forEach(line => {
    line = line.trim();
    if(line == '') {
      out.push(currentLine);
      currentLine = { changes: [] };
    } else if(!line.startsWith('-')) {
      let match = line.match(/[^:]*/);
      currentLine.version = match && match[0] || '???';
    } else {
      let change = line.match(/\-+\s*(.*)/);
      currentLine.changes.push(change && change[1]);
    }
  });
  return out;
}

async function upload_release() {
  const folderName = path.basename(`../${__dirname}`);
  let changes;
  let version = `v${pjson.version}`;
  let changelog = 'New Update';
  console.log(folderName);
  const filename = path.resolve(folderName, '../..', 'changelog.txt');
  console.log(filename);
  if(fs.existsSync(filename)) {
    changes = await readChangeLog(filename);
    version = changes[0].version;
    changelog = changes[0].changes.map(v => `- ${v}`).reduce((a,b,c) => `${a}\n${b}`);
  }
  const archiveName = `${folderName}_${version}.zip`;
  let result;
  result = await octokit.request('POST /repos/{owner}/{repo}/releases', {
    owner: 'TheHorscht',
    // repo: folderName,
    repo: 'gittest2',
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
      'Authorization': `token ${options.token}`,
      'Content-Type': 'application/zip, application/octet-stream',
    },
  }).catch(err => {
    console.log(`${err.response.status} - ${err.response.statusText}`);
  });
}

upload_release();
