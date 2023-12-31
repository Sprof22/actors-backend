import express, {Request, Response} from "express";
import cors from "cors";
import { client as PostgresClient, algoliaIndex } from "./postgres"; // Import the algoliaIndex object
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
  
  app.get("/actors/:object_id", async (req: Request, res: Response) => {
    const objectId = req.params.object_id; // Get the object ID from the URL
  const cacheKey = `actorByObjectId:${objectId}`;
    try {
      // Check Redis cache
      const cachedData = await redisClient.get(cacheKey);
  
      if (cachedData) {
        console.log("Data fetched from cache.");
        return res.status(200).json(JSON.parse(cachedData));
      } else {
        const query = `SELECT * FROM actors WHERE objectID = $1`;
      const results = await PostgresClient.query(query, [objectId]);
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

  app.delete("/actors/:object_id", async (req: Request, res: Response) => {
    const objectId = req.params.object_id;
    const cacheKey = `actorByObjectId:${objectId}`;
  
    try {
      // Delete data from Redis cache
      await redisClient.del(cacheKey);
  
      // Delete data from PostgreSQL database
      const deleteQuery = `DELETE FROM actors WHERE objectID = $1`;
      const deleteResult = await PostgresClient.query(deleteQuery, [objectId]);
  
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ error: "Actor not found" });
      }
  
      // Delete data from Algolia index
      await algoliaIndex.deleteObject(objectId);
  
      return res.status(200).json({ message: "Actor deleted successfully" });
    } catch (error) {
      console.error("Error deleting data:", error);
      return res.status(500).json({ error: "Could not delete actor" });
    }
  });
  
  app.patch("/actors/:object_id", async (req: Request, res: Response) => {
    const objectId = req.params.object_id;
    const cacheKey = `actorByObjectId:${objectId}`;
  
    const updatedData = req.body;
  
    try {
      // Update data in Redis cache
      await redisClient.del(cacheKey);
  
      // Update data in PostgreSQL database
      const updateQuery = `
      UPDATE actors
      SET
        actor_name = $1,
        actor_rating = $2,
        image_path = $3,
        alternative_name = $4
      WHERE objectID = $5
    `;
      const updateResult = await PostgresClient.query(updateQuery, [
        updatedData.actor_name,
        updatedData.actor_rating,
        updatedData.image_path,
        updatedData.alternative_name,
        objectId
      ]);
  
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ error: "Actor not found" });
      }
  
      // Update data in Algolia index
      await algoliaIndex.partialUpdateObject({
        objectID: objectId,
        ...updatedData,
      });
  
      return res.status(200).json({ message: "Actor updated successfully" });
    } catch (error) {
      console.error("Error updating data:", error);
      return res.status(500).json({ error: "Could not update actor" });
    }
  });
  
  app.post("/actors", async (req, res) => {
    try {
      const data = req.body;
      const insertQuery = `
        INSERT INTO actors (actor_name, actor_rating, image_path, alternative_name, actor_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const values = [
        data.actor_name,
        data.actor_rating,
        data.image_path,
        data.alternative_name,
        data.actor_id
      ];
      const result = await PostgresClient.query(insertQuery, values);
  
      // Push data to Algolia index
      const algoliaResponse = await algoliaIndex.saveObject({
        objectID: result.rows[0].objectid,
        ...data,
      });
  
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error inserting data:", error);
      return res.status(500).json({ error: "Could not insert data" });
    }
  });
  

  const PORT = 8080; // You can change this to your desired port number


  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });


  