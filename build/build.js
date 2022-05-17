
// import * as fs from 'fs';
// import * as AdmZip from 'adm-zip';
// import * as path from 'path';
// import * as minimatch from 'minimatch';
// import * as pjson from './package.json';
const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const minimatch = require("minimatch");
const pjson = require('../../package.json');

let preview = false;

const args = process.argv.slice(2);
args.forEach(val => {
  if(val == '--preview') {
    preview = true;
  }
});

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
      if(preview) {
        console.log(item);
      } else {
        zip.addLocalFile(`${root_folder}/${item}`, `${name}/${folderName}`);
      }
    }
  }
};

fs.readdirSync(root_folder).forEach(entry => {
  addFiles(entry);
});

if(!preview) {
  if (!fs.existsSync(out_dir)) {
    fs.mkdirSync(out_dir);
  }
  zip.writeZip(`${out_dir}/${name}_v${version}.zip`);
}




// process.exit(-1);



// Publish




const core = require('@actions/core');
// import { getInput, setFailed } from '@actions/core';
// import { context } from '@actions/github';

let token;
try {
  token = core.getInput('token', { required: true });
} catch (error) {
  core.setFailed(error.message);
}

console.log('blaaaaaa');

const assert = require('assert');
const axios = require('axios').default;
const uriTemplate = require('uri-template');
const { Octokit } = require('@octokit/core');
const octokit = new Octokit({ auth: token });
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
      'Authorization': `token ${process.env.GH_TOKEN}`,
      'Content-Type': 'application/zip, application/octet-stream',
    },
  }).catch(err => {
    console.log(`${err.response.status} - ${err.response.statusText}`);
  });
}

upload_release();
