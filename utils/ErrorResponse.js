class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    // Capture the stack trace (excluding the constructor call from it)
    Error.captureStackTrace(this, this.constructor);
  }

  // Static method to create common error responses
  static unauthorized(message = 'Not authorized') {
    return new ErrorResponse(message, 401);
  }

  static forbidden(message = 'Forbidden') {
    return new ErrorResponse(message, 403);
  }

  static notFound(message = 'Resource not found') {
    return new ErrorResponse(message, 404);
  }

  static badRequest(message = 'Bad request') {
    return new ErrorResponse(message, 400);
  }

  static serverError(message = 'Internal server error') {
    return new ErrorResponse(message, 500);
  }
}

module.exports = ErrorResponse;