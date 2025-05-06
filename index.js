import express from "express";

import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import * as httpServer from "http"; 
import dotenv from "dotenv";
import setupSocket from "./websocket.js";
import { Socket } from "socket.io";
dotenv.config();
import {userSockets} from "./websocket.js";
import haversine from 'haversine-distance'

const app = express();
const PORT = process.env.PORT || 5000;
export const JWT_SECRET = "TOBY_ACTIVITIES_SECRET";
const httpServer2 = httpServer.createServer(app);

console.log("Websocket server started");

app.use(express.json());
app.use(cors());

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// generate a random color for the profile image
function generateRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const io = setupSocket(server);

function isWithinRadius(long1, lat1, long2, lat2, radius) {
  const point1 = { longitude: long1, latitude: lat1 };
  const point2 = { longitude: long2, latitude: lat2 };
  const distance = haversine(point1, point2);
  return distance <= radius;
}

function MatchActivities( userLong, userLat, radius, rows) {
  let newRows = [];

  for (let i = 0; i < rows.length; i++) {
    const activityLong = rows[i].long;
    const activityLat = rows[i].lat;
    if (isWithinRadius(userLong, userLat, activityLong, activityLat, radius)) {
      newRows.push(rows[i]);
    }
  }
  return newRows;
}

function findSimilarActivities(type, long, lat, radius, date_mode, date, userId) {
  console.log("Finding similar activities");
  let newRows = [];
  console.log("SELECT * FROM activities WHERE type_id = ? AND date_mode = ? AND date like ? ", [type, date_mode, date]);
  db.all(`
    SELECT * FROM activities 
    LEFT JOIN (SELECT id, name AS type_name FROM activitytypes) types ON activities.type_id = types.id 
    WHERE type_id = ? AND date_mode = ? 
  `, [type, date_mode], function (err, rows) {
    if (err) {
      console.error(err);
      return;
    }
    newRows = MatchActivities(long, lat, radius, rows);
    console.log("New rows: ", newRows);
    if (newRows.length > 0) {
      console.log("Found similar activities: ", newRows);
      recomendActivities(newRows, userId);
    } else {
      console.log("No similar activities found");
    }
  });
}

function recomendActivities(activities, userId){
  console.log("Recomending activities");
  console.log("Activities: ", activities);
  console.log("UserId: ", userId);
  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    console.log("Activity: ", activity);
    // send to the user
    io.to(userSockets.get(userId)).emit("recommendedactivity", activity);
    //io.emit("message", activity, userSockets.get(userId).socket.id);
    db.run("INSERT INTO recommendations (user_id, activity_id) VALUES (?, ?)", [userId, activity.id]);
  }
}




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

const USERS = 'users';
const PROFILES = 'profiles';

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
    
    db.run(`CREATE TABLE IF NOT EXISTS chatusers (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, user_id INTEGER, FOREIGN KEY(chat_id) REFERENCES chats(id), FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, user_id INTEGER, text TEXT, date TEXT, time TEXT, read BOOLEAN, FOREIGN KEY(chat_id) REFERENCES chats(id), FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);
  
    db.run(`CREATE TABLE IF NOT EXISTS activitytypes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);

    db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type_id INTEGER , name TEXT, long TEXT, lat TEXT, FOREIGN KEY (type_id) REFERENCES activitytypes(id), FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);
  }
});



// async function  getProfile(userId){
//   const rows = await db.get(`SELECT * FROM ${PROFILES} WHERE user_id = ?`, [userId]);
//   return rows[0];
// }

export const authMiddleware = async (req, res, next) => {

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
  const userId = req.user.id;
  let response = {
    user_id: userId,
    profile_image: "",
    bio: "",
    location: "",
    forename: "",
    surname: "",
    age: 0,
    types: [],
  }
  try {
    db.get(`SELECT * FROM ${PROFILES} WHERE profiles.user_id = ?`, [userId], function (err, row) {
      console.log(row);
      if (err || !row) {
        console.error("Sending empty profile");
        res.json(response)
        return;
      }
      response.profile_image = row.profile_image;
      response.bio = row.bio;
      response.location = row.location;
      response.forename = row.forename;
      response.surname = row.surname;
      response.age = row.age;
      response.types = [];

      db.all(`SELECT * FROM profileactivitytypes WHERE user_id = ?`, [userId], function (err, rows) {
        console.log(rows);
        if (err || rows.length === 0) {
          console.log("No activity types found");
          res.json(response)
          return;
        }
        for (let i = 0; i < rows.length; i++) {
          response.types.push(rows[i].type_id);
        }
        res.json(response);
      });}
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
    const color = generateRandomColor();
    db.run("UPDATE profiles SET profile_image = ?, bio = ?, location = ?, forename = ?, surname = ?, age = ?, profile_colour = ? WHERE user_id = ?", [profile_image, bio, location, forename, surname, age, color, userId]);
    db.run("DELETE FROM profileactivitytypes WHERE user_id = ?", [userId], function(err) {
      for (let i = 0; i < types.length; i++) {
        console.log("Inserting profileactivitytypes");
        db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [userId, types[i]]);
      }
    });
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

function isPopulated(value){
  if (value == "" || value == null || value == undefined || value == "undefined" || value == "null" || value == "NaN" || value == NaN) {
    return false;
  }
  return true;
}

app.get("/activities", async (req, res) => {
  console.log("Getting activities");
  const { selectedTypes, startDate, endDate, dateMode, long, lat, radius } = req.query;
  console.log("Selected types: ", selectedTypes);
  console.log("Start date: ", startDate);
  console.log("End date: ", endDate);
  console.log("Date mode: ", dateMode);
  console.log("Long: ", long);
  console.log("Lat: ", lat);
  console.log("Radius: ", radius);
  let query = `SELECT * FROM activities 
    LEFT JOIN (SELECT id as typeid, name AS type_name FROM activitytypes) types ON activities.type_id = types.typeid 
    LEFT JOIN  (SELECT user_id, profile_image, bio, forename, location  from profiles ) profile ON activities.user_id = profile.user_id
    WHERE 1=1
  `;
  const params = [];

  if (isPopulated(selectedTypes)) {
    query += ` AND activities.type_id IN (${selectedTypes.split(',').map(() => '?').join(',')})`;
    params.push(...selectedTypes.split(','));
  }
  // if (isPopulated(startDate)) {
  //   query += ` AND activities.date >= ?`;
  //   params.push(startDate);
  // }
  // if (isPopulated(endDate)) {
  //   query += ` AND activities.date <= ?`;
  //   params.push(endDate);
  // }
  if (isPopulated(dateMode)) {
    query += ` AND activities.date_mode = ?`;
    let tempDateMode = 0;
    if (dateMode == "true") {
      tempDateMode = 1;
    } else {
      tempDateMode = 0;
    }
    params.push(tempDateMode);
  }
  if (isPopulated(long) && isPopulated(lat) && isPopulated(radius)) {
    query += ` AND (ABS(activities.long - ?) <= ? AND ABS(activities.lat - ?) <= ?)`;
    params.push(long, radius, lat, radius);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Error getting activities", error: err });
    } else {
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
            res.json({ token: token, id: this.lastID });
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
        res.json({ token: token, userId: row.id });
      }
    );
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

app.post("/create-activity", authMiddleware, async (req, res) => {
  try {
    const {name, type, long, lat, radius, date_mode, group_size } = req.body;
    console.log(name, type, long, lat , radius, date_mode, group_size);
    if (date_mode == "true") { group_size = 2; };
    
    const userId = req.user.id;
    db.get("SELECT id FROM activitytypes WHERE id = ?", type, function (err ,row) {
      if (err == null) {
        db.run("INSERT INTO activities (user_id, name, type_id, long, lat, radius, date_mode, group_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [userId, name, row.id, long, lat, radius, date_mode, group_size]);
        res.json({ message: "Form submitted successfully" });
      } else {
        console.error(`Invalid type id: ${err}`);
      }
    });
    let date = new Date().toLocaleDateString();
    findSimilarActivities( type, long, lat, radius, date_mode, date, userId);
    console.log("Activity created successfully");

  } catch (err) {
    res.status(400).json({ message: "Error submitting form", error: err });
    console.error(err);
  }

});

app.post("/delete-activity", authMiddleware, async (req, res) => {
  try {
    const { activity_id } = req.body;
    const userId = req.user.id;
    console.log(activity_id);
    db.run("DELETE FROM activities WHERE id = ? AND user_id = ?", [activity_id, userId], function (err) {
      if (err) {
        console.error(err);
        res.json({ message: "Error deleting activity", error: err });
      } else {
        res.json({ message: "Activity deleted successfully" });
      }
      // delete from chats and messages
      db.get("SELECT * FROM chats WHERE activity_id = ?", [activity_id], function (err, row) {
        if (!row) {
          console.log("No chats found for activity");
        } else {

          if (err) {
            console.error(err);
            res.json({ message: "Error deleting chat", error: err });
          } else {
            for (let i = 0; i < row.length; i++) {
              db.run("DELETE FROM messages WHERE chat_id = ?", [row[i].id], function (err) {
                if (err) {
                  console.error(err);
                  res.json({ message: "Error deleting messages", error: err });
                } else {
                  console.log("Messages deleted successfully");
                }
              });
            }
            db.run("DELETE FROM chatusers WHERE chat_id = ?", [row.id], function (err) {
              if (err) {
                console.error(err);
                res.json({ message: "Error deleting chat users", error: err });
              } else {
                console.log("Chat users deleted successfully");
              }
            });
          }
        }
      });
      // delete from chats
      db.run("DELETE FROM chats WHERE activity_id = ?", [activity_id], function(err) {
        if (err) {
          console.error(err);
          res.json({ message: "Error deleting chat", error: err });
        } else {
          console.log("Chat deleted successfully");
        }
      });
    });
  } catch (err) {
    res.json({ message: "Error deleting activity", error: err });
  }
});

app.get("/get-my-activities", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(userId);
    db.all("SELECT * FROM activities WHERE user_id = ?", [userId], function (err, rows) {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Error getting activities", error: err });
      } else {
        console.log(rows);
        res.json(rows);
      }
    });
  } catch (err) {
    res.status(400).json({ message: "Error getting activities", error: err });
  }
}
);

app.get("/get-recommended-activities", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(userId);
    db.all("SELECT * FROM activities LEFT JOIN (SELECT id, name AS type_name FROM activitytypes) types ON activities.type_id = types.id LEFT JOIN profiles ON activities.user_id = profiles.user_id WHERE activities.id IN (SELECT activity_id FROM recommendations WHERE user_id = ?)", [userId], function (err, rows) {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Error getting activities", error: err });
      } else {
        console.log(rows);
        res.json(rows);
      }
    });
  } catch (err) {
    res.status(400).json({ message: "Error getting activities", error: err });
  }
}
);

// export type MessagesStruct = {
//   id: number;
//   user_id: number;
//   name: string;
//   chat_id: number;
//   text: string;
//   date: string;
//   time: string;
//   read: boolean;
// }

app.post("/send-message", authMiddleware, async (req, res) => {
  try {
    const { chat_id, message } = req.body;
    const userId = req.user.id;
    console.log(chat_id, message);
    let chatusers = [];
    // check if the chat exists and the user is in the chat
    db.get("SELECT * FROM chatusers WHERE chat_id = ? AND user_id = ?", [chat_id, userId], function (err, rows) {
      if (err || !rows) {
        console.error("Chat not found or user not in chat");
        return res.status(400).json({ message: "Chat not found or user not in chat" });
      }
      else {
        db.all("SELECT * FROM chatusers WHERE chat_id = ?", [chat_id], function (err, users) {
          if (err) {
            console.error(err);
            res.status(500).json({ message: "Error getting chat users", error: err });
          } else {
            console.log("Chat users: ", users);
            chatusers = users; 
          }
        });
        db.run("INSERT INTO messages (chat_id, user_id, text) VALUES (?, ?, ?)", [chat_id, userId, message], function (err) {
          let id = this.lastID;
          if (err) {
            console.error(err);
            res.status(500).json({ message: "Error sending message", error: err });
          } else {
            try{// send to only the users in the chat
              console.log("Sending message to users in chat: ", chat_id);
              console.log("Chat users: ", chatusers);
              console.log("Chat user lenght", chatusers.length);
              // make chatusers an array of objects with user_id and socket_id
              for (let i = 0; i < chatusers.length; i++) {
                if (chatusers[i].user_id == userId) {
                  console.log("Skipping user: ", chatusers[i].user_id);
                  continue;
                }
                console.log("Sending message to user: ", chatusers[i].user_id);
                id = this.lastID;
                console.log(userSockets);
                if (userSockets.has(chatusers[i].user_id)) {
                  io.to(userSockets.get(chatusers[i].user_id)).emit("message", {
                    id: id,
                    user_id: userId,
                    name: "name",
                    chat_id: chat_id,
                    text: message,
                    date: new Date().toLocaleDateString(),
                    time: new Date().toLocaleTimeString(),
                    read: false
                  }, function (err) {
                    if (err) {
                      console.log("Error sending message to socket, likely user is not connected");
                    } else {
                      console.log("Message sent to socket:", userSockets.get(chatusers[i].user_id).socket_id);
                    }
                  });
                } else {
                  console.log("User not connected: ", chatusers[i].user_id);
                  //io.to(userSockets.get(chatusers[i].user_id).socket_id).emit("message", message, userSockets.get(chatusers[i].user_id).socket_id
                  continue;
                }
              }
            } catch (emitError) {
              console.error("Error emitting message:", emitError);
            }
          }
        }
        );
        console.log("Message sent successfully");
        res.json({ message: "Message sent successfully" });
      }
    });
  } catch (err) {
    res.status(400).json({ message: "Error sending message", error: err });
  }
});

app.get("/get-messages", authMiddleware, async (req, res) => {
  try {
    const { chat_id } = req.query;
    console.log(chat_id);
    // check if the chat exists and the user is in the chat using the chatusers table
    db.get("SELECT * FROM chatusers WHERE chat_id = ? AND user_id = ?", [chat_id, req.user.id], function (err, row) {
      if (err || !row) {
        console.error("Chat not found or user not in chat");
        return res.status(400).json({ message: "Chat not found or user not in chat" });
      }
    });
    db.all("SELECT * FROM messages WHERE chat_id = ?", [chat_id], function (err, rows) {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Error getting messages", error: err });
      } else {
        res.json(rows);
      }
    });
  } catch (err) {
    res.status(400).json({ message: "Error getting messages", error: err });
  }
});

app.get("/get-chats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(userId);
    //cancer....
    db.all(`
                  
          SELECT chat_id,chats.activity_id,chatusers.user_id, forename,profile_colour,activities.name, activitytypes.name as activity_type_name FROM chats LEFT JOIN chatusers ON chats.id = chatusers.chat_id
            LEFT JOIN profiles ON chatusers.user_id = profiles.user_id
            LEFT JOIN activities ON activities.id = chats.activity_id
            LEFT JOIN activitytypes ON activitytypes.id = activities.type_id
          WHERE chats.id IN (SELECT chatusers.chat_id FROM chatusers WHERE user_id = ?) AND chatusers.user_id != ?
        `,
        [userId,userId,], function (err, rows) {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Error getting chats", error: err });
      } else {
        console.log(rows);
        res.json(rows);

      }
    });
    // then use the rows to get the users in the chats using the chatusers table
    // reply with the data in the format of { chat_id: [user_id1, user_id2, ...] }


  } catch (err) {
    res.status(400).json({ message: "Error getting chats", error: err });
  }
});



// run websocket.js
//after the server is started

const addUsersToChat = (callback, chat, ...users) => {
  const subs = [];
  const params = [];
  for (let user of users) {
    subs.push('(?, ?)');
    params.push(chat, user);
  }
  const query = `INSERT INTO chatusers (chat_id, user_id) VALUES ${subs.join(', ')};`;
  db.run(query, params, callback);
}

const newChat = (res, activity_id, ...users) => {
  db.run(`
      INSERT INTO chats (activity_id)
      VALUES
      (?);
    `, [activity_id], function (err) {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error inserting new chat', error: err });
      } else {
        const chat_id = this.lastID;
        addUsersToChat(function(err) {
            if (err) {
              console.error(err);
              res.status(500).json({ message: 'Error inserting members to new chat', error: err });
            } else {
              res.status(201).json({ chat_id: chat_id });
            }
          },
          chat_id,
          ...users
        );
      }
    }
  );
}


const addUserToGroupIfDistinctAndSpace = (res, new_user, chat_id, group_size) => {
  db.all(`
      SELECT user_id
      FROM chatusers
      WHERE chat_id = ?
    `, [chat_id], function (err, rows) {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error checking users in chat', error: err });
      } else {
        let found = false;
        for (let row of rows)
          if (row.user_id == new_user)
            found = true;
        if (found)
          res.status(201).json({ chat_id: chat_id });
        else if (rows.length == group_size) {
          res.status(405).json({ message: 'Group chat full' });
        } else {
          addUsersToChat(() => res.status(202).json({ chat_id: chat_id }), chat_id, new_user);
        }
      }
    }
  );
}

app.post('/join-activity', authMiddleware, async (req, res) => {
  console.log('Joining activity');
  const new_user = req.user.id;
  const { activity_id } = req.body;
  db.get(`
      SELECT id, user_id, date_mode, group_size
      FROM activities
      WHERE id = ?;
    `, [activity_id], function (err, rows) {
      if (err) {
        console.error(err);
        res.status(500).json({ message: 'Error getting activity types', error: err });
      } else {
        console.assert(typeof rows == 'object');
        const { id, user_id, date_mode, group_size } = rows;
        if (date_mode) {
          newChat(res, id, new_user, user_id);
        } else {
          db.all(`
              SELECT id
              FROM chats
              WHERE activity_id = ?
            `, [activity_id], function (err, rows) {
              if (err) {
                console.error(err);
                res.status(500).json({ message: 'Error checking chats for activity', error: err });
              } else {
                if (rows.length == 0) {
                  newChat(res, id, new_user, user_id);
                } else {
                  addUserToGroupIfDistinctAndSpace(res ,new_user, rows[0].id, group_size);
                }
              }
            }
          );
        }
      }
    }
  );
});