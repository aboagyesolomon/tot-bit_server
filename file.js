
require('dotenv').config(); 
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const correctPassword = 0243818668; 

rl.question('Enter installation password: ', (inputPassword) => {
  if (inputPassword === correctPassword) {
    console.log('Password correct. Proceeding with installation...');
    process.exit(0); 
  } else {
    console.error('Incorrect password. Installation aborted.');
    process.exit(1); 
  }
});
