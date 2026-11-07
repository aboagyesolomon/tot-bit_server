const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    console.log('--- authMiddleware hit for', req.method, req.url);

    const authHeader = req.headers.authorization;
    console.log('--- auth header:', authHeader);

    const token = authHeader?.split(' ')[1];
    console.log('--- token extracted?', token ? 'YES (len ' + token.length + ')' : 'NO');

    if (!token) {
        console.log('--- returning 401: no token');
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, '0243818668');
        console.log('--- token verified. user id:', decoded.id);

        let permissions = [];
        try {
            permissions = decoded.permissions ? JSON.parse(decoded.permissions) : [];
            if (!Array.isArray(permissions)) permissions = [];
        } catch (e) {
            console.warn('Bad permissions in token:', decoded.permissions);
        }

        req.user = {
            ...decoded,
            permissions,
        };

        console.log('--- req.user set. calling next()');
        next();
    } catch (err) {
        console.error('--- Token verification error:', err);
        return res.status(401).json({ msg: 'Token is not valid' });
    }
};

module.exports = authMiddleware;