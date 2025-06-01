require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

var admin = require("firebase-admin");

var serviceAccount = require("./firebaseTokenVerify.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firebaseTokenVerify = async (req, res, next) => {
  const { token } = req.headers;

  if (!token) {
    return res.status(401).send("unauthorized access");
  }
  const userInfo = await admin.auth().verifyIdToken(token);

  if (!userInfo) {
    return res.status(401).send("unauthorized access");
  }

  req.decodedEmail = userInfo.email;
  next();
};

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const tokenVerify = (req, res, next) => {
  token = req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoder) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }

    req.decoder = decoder;
    console.log(decoder);
    next();
  });
};

const port = process.env.PORT || 3000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.User_DB}:${process.env.PASS}@cluster0.mycpbjh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const jobColleciton = client.db("jobsDB").collection("allJobs");
    const appliedJobsCollection = client.db("jobsDB").collection("appliedJobs");

    app.post("/jwt", async (req, res) => {
      const profileObj = req.body;

      const token = jwt.sign(profileObj, process.env.TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
      });

      res.send({ message: "Successful" });
    });

    app.post("/logout", async (req, res) => {
      res.clearCookie("token");
      res.status(200).send({ message: "logout Successfully" });
    });

    app.get("/allJobs", async (req, res) => {
      const email = req?.query?.email;
      const query = {};

      if (email) {
        query.hr_email = email;
      }
      const result = await jobColleciton.find(query).toArray();

      for (job of result) {
        const query2 = {
          jobId: job._id.toString(),
        };

        const result2 = await appliedJobsCollection.countDocuments(query2);
        job.totalApplication = result2;
      }
      res.send(result);
    });

    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;

      const query = {
        _id: new ObjectId(id),
      };

      const result = await jobColleciton.findOne(query);
      res.send(result);
    });

    app.get("/appliedJobs", tokenVerify, async (req, res) => {
      const { email } = req.query;
      const reqEmail = req.decoder.email;

      if (email !== reqEmail) {
        return res.status(403).send({ message: "assecc-denied" });
      }

      const query = {
        email: email,
      };

      const result = await appliedJobsCollection.find(query).toArray();

      for (application of result) {
        const query = {
          _id: new ObjectId(application.jobId),
        };
        const job = await jobColleciton.findOne(query);

        application.company = job.company;
        application.category = job.category;
        application.title = job.title;
        application.salaryRange = { ...job.salaryRange };
      }
      res.send(result);
    });

    app.get(
      "/myJobPost/applications/:id",
      firebaseTokenVerify,
      async (req, res) => {
        const { decodedEmail } = req;

        const query = {
          jobId: req.params.id,
        };

        const result = await appliedJobsCollection.find(query).toArray();

        res.send(result);
      }
    );

    app.post("/apply", async (req, res) => {
      const data = req.body;

      const { jobId } = req.body;

      const job = await jobColleciton.findOne({ _id: new ObjectId(jobId) });

      data.company = job.company;
      data.title = job.title;

      const result = await appliedJobsCollection.insertOne(data);
      res.send(result);
    });

    app.post("/postJob", async (req, res) => {
      const result = await jobColleciton.insertOne(req.body);
      res.send(result);
    });

    app.patch("/applicationUpdate/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = {
        _id: new ObjectId(id),
      };

      const option = {
        upsert: true,
      };

      const updatedValue = {
        $set: {
          status: req.body.status,
        },
      };

      const result = await appliedJobsCollection.updateOne(
        query,
        updatedValue,
        option
      );

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("code your career");
});
app.listen(port, () => {
  console.log("listing from port ", port);
});
