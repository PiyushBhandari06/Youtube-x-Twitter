class apiResponse {
    constructor(statusCode, data, message){
        this.statusCode = statusCode
        this.data = data
        this.message = message

        this.success = statusCode < 400
        // means that the success property will be set to true only if the statusCode is less than 400.
    }
}

export {apiResponse}

// eg :-
// {
//   "statusCode": 200,
//   "data": {
//     "name": "John"
//   },
//   "message": "User fetched",
//   "success": true
// }