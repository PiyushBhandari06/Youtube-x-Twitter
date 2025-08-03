class apiError extends Error{
    // It is a custom error class that extends the built-in Error class in JavaScript.
    // It lets you throw rich, consistent, structured error responses in your API — with status codes, messages, and even a stack trace if needed.
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors

        if(stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export {apiError}