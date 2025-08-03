// socialvibe/backend/Validators/SharedValidator.js
const { param } = require('express-validator');
const mongoose = require('mongoose');

const validateObjectId = (paramName) => [
    param(paramName).custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
            throw new Error(`${paramName} is not a valid ObjectId`);
        }
        return true;
    }).withMessage(`Invalid ${paramName} ID`)
];

module.exports = {
    validateObjectId
};