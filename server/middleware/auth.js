const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smartcut_secret_2026';

const verifyToken = (req, res, next, allowedTypes) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (allowedTypes && !allowedTypes.includes(decoded.type)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const authenticate = (req, res, next) => verifyToken(req, res, next, null);
const authenticateCustomer = (req, res, next) => verifyToken(req, res, next, ['customer']);
const authenticateBarbershop = (req, res, next) => verifyToken(req, res, next, ['barbershop']);
const authenticateBarber = (req, res, next) => verifyToken(req, res, next, ['barber']);
const authenticateAdmin = (req, res, next) => verifyToken(req, res, next, ['admin']);
const authenticateBarbershopOrBarber = (req, res, next) => verifyToken(req, res, next, ['barbershop', 'barber']);

module.exports = { authenticate, authenticateCustomer, authenticateBarbershop, authenticateBarber, authenticateAdmin, authenticateBarbershopOrBarber, JWT_SECRET };
