const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.getQzCertificate = (req, res) => {
  try { const certPath = path.join(__dirname, '..', 'qz-cert', 'digital-certificate.txt');

    if (!fs.existsSync(certPath)) {
      return res.status(404).send('QZ certificate not found');
    }

    res.type('text/plain');
    res.send(fs.readFileSync(certPath, 'utf8'));

  } catch (error) {
    console.error('QZ certificate error:', error);
    res.status(500).send('Error loading QZ certificate');
  }
};

exports.signQzRequest = (req, res) => {
  try {
    const keyPath = path.join(__dirname,'..','qz-cert','private-key.pem');

    if (!fs.existsSync(keyPath)) {
      return res.status(404).send('QZ private key not found');
    }

    const privateKey = fs.readFileSync(keyPath, 'utf8');

    const signer = crypto.createSign('RSA-SHA512');
    signer.update(req.body);
    signer.end();

    const signature = signer.sign(privateKey, 'base64');

    res.type('text/plain');
    res.send(signature);

  } catch (error) {
    console.error('QZ signing error:', error);
    res.status(500).send('Error signing QZ request');
  }
};