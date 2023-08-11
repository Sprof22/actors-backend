import express, {Request, Response} from "express";
import cors from "cors";
import {client as PostgresClient} from "./postgres"
import redisClient from "./redisClient"
const app = express();
app.use(express.json());
app.use(cors());


app.get("/actors", async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 499;
  
    try {
      const offset = (page - 1) * limit;
      const query = `SELECT * FROM actors OFFSET ${offset} LIMIT ${limit}`;
      const cacheKey = `actors:${offset}:${limit}`;
  
      // Check Redis cache
      const cachedData = await redisClient.get(cacheKey);
  
      if (cachedData) {
        console.log("Data fetched from cache.");
        return res.status(200).json(JSON.parse(cachedData));
      } else {
        const results = await PostgresClient.query(query);
        const data = results.rows;
  
        // Cache data in Redis
        await redisClient.set(cacheKey, JSON.stringify(data), "EX", 3600); // Cache for 1 hour
  
        return res.status(200).json(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error); // Log the specific error
      return res.status(500).json({ error: "Could not fetch documents" });
    }
  });
  
  app.get("/actors/:actor_id", async (req: Request, res: Response) => {
    const actorId = req.params.actor_id; // Get the actor ID from the URL
    console.log("first", actorId)
    const cacheKey = `actor:${actorId}`;
  
    try {
      // Check Redis cache
      const cachedData = await redisClient.get(cacheKey);
  
      if (cachedData) {
        console.log("Data fetched from cache.");
        return res.status(200).json(JSON.parse(cachedData));
      } else {
        const query = `SELECT * FROM actors WHERE actor_id = $1`;
        const results = await PostgresClient.query(query, [actorId]);
        const data = results.rows[0]; // Assuming id is unique and there's only one result
  
        if (!data) {
          return res.status(404).json({ error: "Actor not found" });
        }
  
        // Cache data in Redis
        await redisClient.set(cacheKey, JSON.stringify(data), "EX", 3600); // Cache for 1 hour
  
        return res.status(200).json(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error); // Log the specific error
      return res.status(500).json({ error: "Could not fetch actor" });
    }
  });

  app.delete("/actors/:id", async (req: Request, res: Response) => {
    const actorId = req.params.id; // Get the actor ID from the URL
    const cacheKey = `actor:${actorId}`;
  
    try {
      // Delete data from Redis cache
      await redisClient.del(cacheKey);
  
      // Delete data from PostgreSQL database
      const deleteQuery = `DELETE FROM actors WHERE actor_id = $1`;
      const deleteResult = await PostgresClient.query(deleteQuery, [actorId]);
  
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ error: "Actor not found" });
      }
  
      return res.status(200).json({ message: "Actor deleted successfully" });
    } catch (error) {
      console.error("Error deleting data:", error); // Log the specific error
      return res.status(500).json({ error: "Could not delete actor" });
    }
  });
  
  app.patch("/actors/:id", async (req: Request, res: Response) => {
    const actorId = req.params.id; // Get the actor ID from the URL
    const cacheKey = `actor:${actorId}`;
  
    const updatedData = req.body; // Assuming the updated data is sent in the request body
  
    try {
      // Update data in Redis cache
      await redisClient.del(cacheKey); // Delete old cached data
  
      // Update data in PostgreSQL database
      const updateQuery = `
        UPDATE actors
        SET actor_name = $1, actor_rating = $2, image_path = $3, alternative_name = $4
        WHERE actor_id = $5
      `;
      const updateResult = await PostgresClient.query(updateQuery, [
        updatedData.actor_name,
        updatedData.actor_rating,
        updatedData.image_path,
        updatedData.alternative_name,
        actorId
      ]);
  
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ error: "Actor not found" });
      }
  
      return res.status(200).json({ message: "Actor updated successfully" });
    } catch (error) {
      console.error("Error updating data:", error); // Log the specific error
      return res.status(500).json({ error: "Could not update actor" });
    }
  });
  
  app.post("/actors", async (req: Request, res: Response) => {
    const newActorData = req.body; // Assuming the new actor data is sent in the request body
  
    try {
      // Insert data into PostgreSQL database
      const insertQuery = `
        INSERT INTO actors (actor_name, actor_rating, image_path, alternative_name)
        VALUES ($1, $2, $3, $4)
        RETURNING actor_id
      `;
      const insertResult = await PostgresClient.query(insertQuery, [
        newActorData.actor_name,
        newActorData.actor_rating,
        newActorData.image_path,
        newActorData.alternative_name
      ]);
  
      const newActorId = insertResult.rows[0].actor_id;
  
      // Clear Redis cache (optional, if you want to refresh the cached actor list)
      // You can also invalidate related cache keys if needed
  
      return res.status(201).json({ message: "Actor created successfully", actor_id: newActorId });
    } catch (error) {
      console.error("Error creating actor:", error); // Log the specific error
      return res.status(500).json({ error: "Could not create actor" });
    }
  });
  

  const PORT = 8080; // You can change this to your desired port number


  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });


  