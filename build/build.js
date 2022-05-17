import { getInput, setFailed } from '@actions/core';
const token = getInput('token', { required: true });
console.log(token);
