
//whenever we are going to send a response we will be using this class 
class ApiResponse {
    constructor(statusCode,data,message = "Success"){
        this.statusCode = statusCode
        this.data = data,
        this.message = message
        this.success = statusCode < 400 
    }
}




/* info about status codes
Informational responses (100 – 199)
Successful responses (200 – 299)
Redirection messages (300 – 399)
Client error responses (400 – 499)
Server error responses (500 – 599)
*/