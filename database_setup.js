const sqlite3 = require("sqlite3").verbose();

const activitiestype = [
    "Hiking",
    "Cycling",
    "Running",
    "Swimming",
    "Yoga",
    "Dance",
    "Gym",
    "Football",
    "Basketball",
    "Tennis",
    "Golf",,
    "Volleyball",
    "Badminton",
    "Table Tennis",
    "Squash",
    "Bowling",
    "Pool",
    "Pub Quiz",
    "Board Games",
];

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
      
      db.run(`CREATE TABLE IF NOT EXISTS chatusers (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, user_id INTEGER, FOREIGN KEY(chat_id) REFERENCES chats(id), FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);

      db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, user_id INTEGER, text TEXT, date TEXT, time TEXT, read BOOLEAN, FOREIGN KEY(chat_id) REFERENCES chats(id), FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);
    
      db.run(`CREATE TABLE IF NOT EXISTS activitytypes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
  
      db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type_id INTEGER , name TEXT, long TEXT, lat TEXT, FOREIGN KEY (type_id) REFERENCES activitytypes(id), FOREIGN KEY(user_id) REFERENCES ${USERS}(id))`);
    }
});

activitiestype.forEach((type) => {
    db.run("INSERT INTO activitytypes (name) VALUES (?)", [type]);
});  

function createData(){
    db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ["Toby", "toby@toby", "password"]);
    db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ["John", "john@john", "password"]);
    db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ["Jane", "jane@jane", "password"]);
    db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ["Alice", "alice@alice", "password"]);
    db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", ["Bob", "bob@bob", "password"]);

    db.run("INSERT INTO profiles (user_id, profile_image, bio, location) VALUES (?, ?, ?, ?)", [1, "profile1.jpg", "I like to hike", "London"]);
    db.run("INSERT INTO profiles (user_id, profile_image, bio, location) VALUES (?, ?, ?, ?)", [2, "profile2.jpg", "I like to cycle", "Manchester"]);
    db.run("INSERT INTO profiles (user_id, profile_image, bio, location) VALUES (?, ?, ?, ?)", [3, "profile3.jpg", "I like to run", "Birmingham"]);
    db.run("INSERT INTO profiles (user_id, profile_image, bio, location) VALUES (?, ?, ?, ?)", [4, "profile4.jpg", "I like to swim", "Liverpool"]);
    db.run("INSERT INTO profiles (user_id, profile_image, bio, location) VALUES (?, ?, ?, ?)", [5, "profile5.jpg", "I like to play football", "Leeds"]);

    db.run("INSERT INTO activities (user_id, type_id, name, long, lat) VALUES (?, ?, ?, ?, ?)", [1, 1, "Hiking", "51.5074", "0.1278"]);
    db.run("INSERT INTO activities (user_id, type_id, name, long, lat) VALUES (?, ?, ?, ?, ?)", [2, 2, "Cycling", "53.4808", "2.2426"]);
    db.run("INSERT INTO activities (user_id, type_id, name, long, lat) VALUES (?, ?, ?, ?, ?)", [3, 3, "Running", "52.4862", "1.8904"]);
    db.run("INSERT INTO activities (user_id, type_id, name, long, lat) VALUES (?, ?, ?, ?, ?)", [4, 4, "Swimming", "53.4084", "2.9916"]);
    db.run("INSERT INTO activities (user_id, type_id, name, long, lat) VALUES (?, ?, ?, ?, ?)", [5, 5, "Yoga", "53.4084", "2.9916"]);

    // Create fake profileactivitytypes for testing in the database
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [1, 5]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [1, 6]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [1, 7]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [2, 7]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [2, 8]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [3, 9]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [3, 4]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [4, 3]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [4, 1]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [5, 2]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [5, 3]);
    db.run("INSERT INTO profileactivitytypes (user_id, type_id) VALUES (?, ?)", [5, 4]);
  // Create fake chats for testing in the database and messages
    db.run("INSERT INTO chats (activity_id) VALUES (?)", [1]);
    db.run("INSERT INTO chats (activity_id) VALUES (?)", [2]);
    db.run("INSERT INTO chats (activity_id) VALUES (?)", [3]);
    db.run("INSERT INTO chats (activity_id) VALUES (?)", [4]);
    db.run("INSERT INTO chats (activity_id) VALUES (?)", [5]);

    db.run("INSERT INTO chatusers (chat_id, user_id) VALUES (?, ?)", [1, 1]);
    db.run("INSERT INTO chatusers (chat_id, user_id) VALUES (?, ?)", [1, 2]);
    db.run("INSERT INTO chatusers (chat_id, user_id) VALUES (?, ?)", [2, 3]);
    db.run("INSERT INTO chatusers (chat_id, user_id) VALUES (?, ?)", [2, 4]);
    db.run("INSERT INTO chatusers (chat_id, user_id) VALUES (?, ?)", [3, 5]);
    db.run("INSERT INTO chatusers (chat_id, user_id) VALUES (?, ?)", [3, 1]);

    db.run("INSERT INTO messages (chat_id, user_id, text, date, time, read) VALUES (?, ?, ?, ?, ?, ?)", [1, 1, "Hello", "2023-10-01", "10:00", 0]);
    db.run("INSERT INTO messages (chat_id, user_id, text, date, time, read) VALUES (?, ?, ?, ?, ?, ?)", [1, 2, "Hi", "2023-10-01", "10:01", 0]);
    db.run("INSERT INTO messages (chat_id, user_id, text, date, time, read) VALUES (?, ?, ?, ?, ?, ?)", [2, 3, "How are you?", "2023-10-01", "10:02", 0]);
    db.run("INSERT INTO messages (chat_id, user_id, text, date, time, read) VALUES (?, ?, ?, ?, ?, ?)", [2, 4, "Good", "2023-10-01", "10:03", 0]);
    db.run("INSERT INTO messages (chat_id, user_id, text, date, time, read) VALUES (?, ?, ?, ?, ?, ?)", [3, 5, "Great!", "2023-10-01", "10:04", 0]);
  }

createData();