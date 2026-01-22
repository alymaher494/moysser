require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Load configurations
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

// Load Middlewares
const loggerMiddleware = require('../middlewares/logger.middleware');
const errorMiddleware = require('../middlewares/error.middleware');

// Load Routes
const apiRoutes = require('../routes/index');

const app = express();

/**
 * Standard Middlewares
 */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggerMiddleware);

/**
 * Static Files
 */
app.use(express.static(path.join(__dirname, '../public')));

/**
 * API Routes
 */
app.use('/api', apiRoutes);

/**
 * Checkout Flow Routes
 */
const checkoutRoutes = require('../routes/checkout');
app.use('/checkout', checkoutRoutes);

/**
 * Handle Landing Page (Root)
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
        if (err) {
            // If index.html doesn't exist, use the landing route from API
            res.redirect('/api');
        }
    });
});

/**
 * 404 Handler
 */
app.use((req, res, next) => {
    next(new NotFoundError(`The requested path ${req.originalUrl} was not found`));
});

/**
 * Global Error Handler
 */
app.use(errorMiddleware);

// Export the app for Vercel Serverless Functions
module.exports = app;

/**
 * Local Development Server
 */
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`);
    });
}
