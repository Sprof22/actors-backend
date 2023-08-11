import Redis from 'ioredis';

const redisClient = new Redis("rediss://default:c84511a1414541deb264399bd6e53cad@usw1-ready-killdeer-33564.upstash.io:33564")


// Listen for the "connect" event
redisClient.on("connect", () => {
    console.log("Redis client connected");
  });
  
  // You can also listen for other events, like "error" or "end"
  redisClient.on("error", (error) => {
    console.error("Redis client error:", error);
  });
  
  redisClient.on("end", () => {
    console.log("Redis client connection ended");
  });
  

  export default redisClient