require('dotenv').config()
const { exec } = require('child_process')
const { promisify } = require('util')
const fse = require('fs-extra')
var fs = require('fs');
const { join } = require('path');
var dir = './tmp';

const existsAsync = promisify(fs.exists)
const mkdirAsync = promisify(fs.mkdir)
const unlinkAsync = promisify(fs.unlink)
const execAsync = promisify(exec)


const command = ({ contract, source, include, dir }) => {
  const volume = dir
  let cmd = ""
  let inc = include == "" ? "./include" : include
  
  if (process.env.COMPILER === 'local') {
    cmd = "cd build && cmake .. && make"
  } else {    
    cmd = `docker run --rm --volume ${volume}:${volume} -w ${volume} eosio/key-value-example:v1.0.0 /bin/bash -c "cd build && cmake .. && make"`
  }
  console.log("compiler command: " + cmd);
  return cmd
}

const compile = async ({ contract, source, include = "" }) => {
// make sure source exists

const contractFound = await existsAsync(source)
if (!contractFound) {
  throw new Error('Contract not found: '+contract+' No source file: '+source);
}

const dir = process.cwd() + "/"

// make sure build exists
const build = join(dir, 'build')
const buildFound = await existsAsync(build)
if (!buildFound){
  console.log("creating build directory...")
  await mkdirAsync(build)
}
await deleteIfExists(build+"/"+contract +"/"+contract+".wasm")
await deleteIfExists(build+"/"+contract +"/"+contract+".abi")

// run compile
const execCommand = command({ contract, source, include, dir })
await execAsync(execCommand)
}


const deleteIfExists = async (file) => {
  const fileExists = await existsAsync(file)
  if (fileExists) {
    try {
      await unlinkAsync(file)
      //console.log("deleted existing ", file)
    } catch(err) {
      console.error("delete file error: "+err)
    }
  }
}

module.exports = compile
