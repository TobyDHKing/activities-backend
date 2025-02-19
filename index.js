const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = "TOBY_ACTIVITIES_SECRET";

app.use(express.json());
app.use(cors());

// DATA STRUCTURES
/*
User 
  - id: bumber
  - name: string
  - email: string
  - password: string
Activity
  - id: bumber
  - name: string
  - description: string
  - date: string
  - time: string
  - location: string
  - user: User
  - participants: User[]
  - chats: Chat[]
Profile
  - user: User
  - profileImage: string
  - bio: string
  - location: string

Chat 
  - id: bumber
  - users: User[]
  - activity: activity
Message
  - id: bumber
  - text: string
  - user: User
  - chat: Chat
  - date: string
  - time: string
  - read: boolean

Activity Type

*/




USERS = 'users';
PROFILES = 'profiles';




const db = new sqlite3.Database("database.sqlite", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log(`Connected to SQLite database.`);
    //drop tables
    
    db.run(`CREATE TABLE IF NOT EXISTS ${USERS} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, password TEXT)`);

    db.run(`CREATE TABLE IF NOT EXISTS ${PROFILES} (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, profile_image TEXT, bio TEXT, location TEXT, forename TEXT, surname TEXT, age INTEGER, FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);

    db.run('CREATE TABLE IF NOT EXISTS profileactivitytypes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type_id INTEGER, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(type_id) REFERENCES activitytypes(id))');

    db.run(`CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER, FOREIGN KEY(activity_id) REFERENCES activities(id))`);
    
    db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, user_id INTEGER, text TEXT, date TEXT, time TEXT, read BOOLEAN, FOREIGN KEY(chat_id) REFERENCES chats(id), FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);
  
    db.run(`CREATE TABLE IF NOT EXISTS activitytypes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);

    db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type_id INTEGER , name TEXT, long TEXT, lat TEXT, FOREIGN KEY (type_id) REFERENCES activitytypes(id), FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);
  }
});



// async function  getProfile(userId){
//   const rows = await db.get(`SELECT * FROM ${PROFILES} WHERE user_id = ?`, [userId]);
//   return rows[0];
// }

const authMiddleware = async (req, res, next) => {

  //if (!token) return res.status(401).json({ message: "Access Denied" });
  try {
    console.log("Authenticating Here ------------------------");
    const token = req.headers.authorization.split(' ')[1];
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid Token" });
  }
};

app.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    // write a query to get the profile of the user and join profile table with the profileactivitytypes table to get the activity types

    
    //SELECT * FROM profiles INNER JOIN profileactivitytypes ON profiles.user_id = profileactivitytypes.user_id WHERE profiles.user_id LIKE 2;
    console.log(`SELECT * FROM ${PROFILES} INNER JOIN profileactivitytypes ON profiles.user_id = profileactivitytypes.user_id WHERE profiles.user_id = ` + userId);
    await db.all(`SELECT * FROM ${PROFILES} INNER JOIN profileactivitytypes ON profiles.user_id = profileactivitytypes.user_id WHERE profiles.user_id = ?`, [userId],
      function (err, rows) {
        console.log(rows);
        if (err || rows.length === 0) {
          console.error("Sending empty profile");
          res.json({
            user_id: userId,
            profile_image: "",
            bio: "",
            location: "",
            forename: "",
            surename: "",
            age: 0,
            types: [],
          })
        } else {
          for (let i = 0; i < rows.length; i++) {
            if (rows[i].user_id === userId) {
              rows[i].types = [];
              for (let j = 0; j < rows.length; j++) {
                if (rows[j].user_id === userId) {
                  rows[i].types.push(rows[j].type_id);
                }
              }
            }
          }
          console.log("Result");
          console.log(rows);
          res.json(rows);
        }
      }
    );
  } catch (err) {
    res.status(400).json({ message: "Error getting profile", error: err });
  }
});

app.post("/update-profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(userId);
    const { profile_image, bio, location, forename, surname, age, types } = req.body;
    console.log(profile_image, bio, location, forename, surname, age, types);
    db.run("UPDATE profiles SET profile_image = ?, bio = ?, location = ?, forename = ?, surname = ?, age = ? WHERE user_id = ?", [profile_image, bio, location, forename, surname, age, userId]);
    db.run("DELETE FROM profileactivitytypes WHERE user_id = ?", [userId]);
    for (let i = 0; i < types.length; i++) {
      console.log("Inserting profileactivitytypes");
      db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [userId, types[i]]);
    }
    console.log("Profile updated successfully");
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    res.status(400).json({ message: "Error updating profile", error: err });
  }
});



app.get("/", (req, res) => {
  res.send("Hello World");
  }
);

app.get("/activities", async (req, res) => {
  console.log("Getting activities");
  db.all("SELECT * FROM activities LEFT JOIN (SELECT id, name AS type_name FROM activitytypes) types ON activities.type_id = types.id LEFT JOIN profiles ON activities.user_id = profiles.user_id", (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Error getting activities", error: err });
    } else {
      //console.log(rows);
      res.json(rows);
    }
  });
});


app.get("/activitiestype", async (req, res) => {
  
  db.all("SELECT * FROM activitytypes", (err, rows) => {
    res.json(rows);
  });
});

app.post("/signup", async (req, res) => {
  // cheack if the user already exists

  console.log(req.body);
  try {
    db.get(`SELECT * FROM ${USERS} WHERE email = ?`, [req.body.email], async function (err, row) {
      if (row) {
        return res.status(400).json({ success: 'false', error: "User already exists" });
      }else{
        const { name, email, password } = req.body;
        console.log(name, email, password);
        const hashedPassword = await bcrypt.hash(password, 10);
    
        
        db.run(
          `INSERT INTO ${USERS} (name, email, password) VALUES (?, ?, ?)`,
          [name, email, hashedPassword],
          function (err) {
            const token = jwt.sign({ id: this.lastID }, JWT_SECRET, { expiresIn: "1h" });
            db.run("INSERT INTO profiles (user_id, profile_image, bio, location, forename, surname, age) VALUES (?, ?, ?, ?, ?, ? ,?)", [this.lastID, "", "", "","","", 0]);
            res.json(token);
          }
        );
      }
    });
  } catch (err) {
      res.status(401).json({ success: 'false', error: err });
  }
});




app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    await db.get(`SELECT * FROM ${USERS} WHERE email = ?`, [email],
      async function (err, row) {
        if (!row){
          console.log("errored Login")
          return res.status(400).json({success:'false' });
        }
        console.log(row)
        if (err && row || !(await bcrypt.compare(password, row.password))) {
          console.log("Failed Password stuff")
          return res.status(400).json({  success: 'false' });
        }
        const token = jwt.sign({ id: row.id }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
      }
    );
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

app.post("/create-activity", authMiddleware, async (req, res) => {
  try {
    const {name, type, long, lat, radius } = req.body;
    console.log(name, type, long, lat , radius);
    const userId = req.user.id;
    db.get("SELECT id FROM activitytypes WHERE id = ?", type, function (err ,row) {
      if (err == null) {
        db.run("INSERT INTO activities (user_id, name, type_id, long, lat) VALUES (?, ?, ?, ?, ?)", [userId, name, row.id, long, lat]);
        res.json({ message: "Form submitted successfully" });
      } else {
        console.error(`Invalid type id: ${err}`);
      }
    });
    
  } catch (err) {
    res.status(400).json({ message: "Error submitting form", error: err });
    console.error(err);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



// create 10 fake users and profiles for testing in the database

