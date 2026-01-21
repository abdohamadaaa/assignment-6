npm init -y
npm install express sequelize mysql2

*************************************************************************************

src/
│
├── models/
│   ├── index.js
│   ├── User.js
│   ├── Post.js
│   └── Comment.js
│
├── routes/
│   ├── user.routes.js
│   ├── post.routes.js
│   └── comment.routes.js
│
├── app.js
└── server.js
bonus.js

******************************************************************************************

const { Sequelize } = require("sequelize");

const sequelize = new Sequelize("assignment7", "root", "password", {
  dialect: "mysql",
  logging: false,
});

const User = require("./User")(sequelize);
const Post = require("./Post")(sequelize);
const Comment = require("./Comment")(sequelize);

// Associations
User.hasMany(Post, { foreignKey: "userId" });
Post.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Comment, { foreignKey: "userId" });
Comment.belongsTo(User, { foreignKey: "userId" });

Post.hasMany(Comment, { foreignKey: "postId" });
Comment.belongsTo(Post, { foreignKey: "postId" });

module.exports = { sequelize, User, Post, Comment };

*******************************************************************************************

const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "User",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING },
      email: {
        type: DataTypes.STRING,
        unique: true,
        validate: {
          isEmail: true, // built-in validation
        },
      },
      password: {
        type: DataTypes.STRING,
        validate: {
          checkPasswordLength(value) {
            if (value.length <= 6) {
              throw new Error("Password must be more than 6 characters");
            }
          },
        },
      },
      role: {
        type: DataTypes.ENUM("user", "admin"),
        defaultValue: "user",
      },
    },
    {
      hooks: {
        beforeCreate(user) {
          if (user.name.length <= 2) {
            throw new Error("Name must be longer than 2 characters");
          }
        },
      },
    }
  );

  ************************************************************************************

  const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Post extends Model {}

  Post.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      title: DataTypes.STRING,
      content: DataTypes.TEXT,
      userId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Post",
      paranoid: true, // soft delete
    }
  );

  return Post;
};

***************************************************************************************

const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Comment extends Model {}

  Comment.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      content: DataTypes.TEXT,
      postId: DataTypes.INTEGER,
      userId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Comment",
    }
  );

  return Comment;
};

************************************************************************************

const express = require("express");
const router = express.Router();
const { User } = require("../models");


router.post("/signup", async (req, res) => {
  try {
    const exists = await User.findOne({ where: { email: req.body.email } });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const user = User.build(req.body);
    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


router.put("/:id", async (req, res) => {
  const result = await User.upsert(req.body, { validate: false });
  res.json(result);
});


router.get("/by-email", async (req, res) => {
  const user = await User.findOne({ where: { email: req.query.email } });
  res.json(user);
});


router.get("/:id", async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    attributes: { exclude: ["role"] },
  });
  res.json(user);
});

module.exports = router;

************************************************************************************

const express = require("express");
const router = express.Router();
const { Post, User, Comment, sequelize } = require("../models");


router.post("/", async (req, res) => {
  const post = new Post(req.body);
  await post.save();
  res.json(post);
});


router.delete("/:postId", async (req, res) => {
  const post = await Post.findByPk(req.params.postId);
  if (post.userId !== req.body.userId)
    return res.status(403).json({ message: "Not allowed" });

  await post.destroy();
  res.json({ message: "Post deleted" });
});


router.get("/details", async (req, res) => {
  const posts = await Post.findAll({
    attributes: ["id", "title"],
    include: [
      { model: User, attributes: ["id", "name"] },
      { model: Comment, attributes: ["id", "content"] },
    ],
  });
  res.json(posts);
});


router.get("/comment-count", async (req, res) => {
  const posts = await Post.findAll({
    attributes: [
      "id",
      "title",
      [sequelize.fn("COUNT", sequelize.col("Comments.id")), "commentCount"],
    ],
    include: [{ model: Comment, attributes: [] }],
    group: ["Post.id"],
  });
  res.json(posts);
});

module.exports = router;

***********************************************************************************

const express = require("express");
const router = express.Router();
const { Comment, User, Post } = require("../models");
const { Op } = require("sequelize");


router.post("/", async (req, res) => {
  const comments = await Comment.bulkCreate(req.body);
  res.json(comments);
});


router.patch("/:commentId", async (req, res) => {
  const comment = await Comment.findByPk(req.params.commentId);
  if (comment.userId !== req.body.userId)
    return res.status(403).json({ message: "Forbidden" });

  comment.content = req.body.content;
  await comment.save();
  res.json(comment);
});


router.post("/find-or-create", async (req, res) => {
  const [comment] = await Comment.findOrCreate({ where: req.body });
  res.json(comment);
});


router.get("/search", async (req, res) => {
  const result = await Comment.findAndCountAll({
    where: { content: { [Op.like]: `%${req.query.word}%` } },
  });
  res.json(result);
});


router.get("/newest/:postId", async (req, res) => {
  const comments = await Comment.findAll({
    where: { postId: req.params.postId },
    limit: 3,
    order: [["createdAt", "DESC"]],
  });
  res.json(comments);
});


router.get("/details/:id", async (req, res) => {
  const comment = await Comment.findByPk(req.params.id, {
    include: [User, Post],
  });
  res.json(comment);
});

module.exports = router;

***************************************************************************************

const express = require("express");
const app = express();

app.use(express.json());

app.use("/users", require("./routes/users"));
app.use("/posts", require("./routes/posts"));
app.use("/comments", require("./routes/comments"));

module.exports = app;

***************************************************************************************

const app = require("./app");
const { sequelize } = require("./models");

sequelize.sync().then(() => {
  app.listen(3000, () => console.log("Server running on port 3000"));
});

