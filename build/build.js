import { getInput, setFailed } from '@actions/core';
const token = core.getInput('token', { required: true });
console.log(token);
