const mongoose = require("mongoose");
const Store = mongoose.model("Store");
const User = mongoose.model("User");
const Review = mongoose.model("Review");
const multer = require("multer");
const jimp = require("jimp");
const uuid = require("uuid");

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith("image/");
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: "That file type isn't allowed!" }, false);
    }
  },
};

exports.homePage = (req, res) => {
  res.render("index");
};

exports.addStore = (req, res) => {
  res.render("editStore", { title: "Add Store" });
};

exports.upload = multer(multerOptions).single("photo");

exports.resize = async (req, res, next) => {
  // check if there is no new file to resize
  if (!req.file) {
    next();
    return;
  }

  const extension = req.file.mimetype.split("/")[1];
  req.body.photo = `${uuid.v4()}.${extension}`;

  // resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  // next
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await new Store(req.body).save();

  req.flash(
    "success",
    `Successfully created ${store.name}. Care to leave a review?`
  );
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  // Query DB for a list of stores
  // const stores = await Store.find();

  const page = req.params.page || 1;
  const limit = 4;
  const skip = page * limit - limit;

  // Query DB for a list of stores
  const storesPromise = Store.find()
    .skip(skip)
    .limit(limit)
    .sort({ created: "desc" });
  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);

  const pages = Math.ceil(count / limit);

  if (!stores.length && skip) {
    req.flash(
      "info",
      `This page ${page} does not exist! Last avaliable page here is ${pages}.`
    );
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render("stores", { title: "Stores", stores, page, pages, count });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error("You must own a store in order to edit it!");
  }
};

exports.editStore = async (req, res) => {
  // Find store by the given ID
  const store = await Store.findOne({ _id: req.params.id });
  // Confirm they are the owner of the store
  confirmOwner(store, req.user);
  // Render out the edit form so the user can update their store
  res.render("editStore", { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  // Set location data to be Point
  req.body.location.type = "Point";
  // Find and update the store
  const store = await Store.findByIdAndUpdate(
    { _id: req.params.id },
    req.body,
    {
      new: true, // Return a new store instead of an old one
      runValidators: true,
    }
  ).exec();

  req.flash(
    "success",
    `Successfully updated <strong>${store.name}</strong>. <a href="/store/${store.slug}">View Store →</a>`
  );
  // Redirect and let know it's updated
  res.redirect(`/stores/${store._id}/edit`);
};

exports.deleteStore = async (req, res) => {
  // Remove the store from DB
  const storePromise = Store.findOneAndRemove({ _id: req.params.id });
  // Remove all related reviews to that store
  const reviewPromise = Review.deleteMany({ store: { _id: req.params.id } });
  // Remove that store from users "hearted" list
  const userPromise = User.updateMany(
    { hearts: req.params.id },
    { $pull: { hearts: req.params.id } },
    { new: true }
  );

  const [store, review, user] = await Promise.all([
    storePromise,
    reviewPromise,
    userPromise,
  ]);

  req.flash(
    "success",
    `Your <strong>${store.name}</strong> store has been removed!`
  );

  res.json(store);
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate(
    "author reviews"
  );
  if (!store) return next();
  res.render("store", { store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render("tag", { tags, title: "Tags", tag, stores });
};

exports.searchStores = async (req, res) => {
  const stores = await Store
    // Find store that match
    .find(
      {
        $text: {
          $search: req.query.q,
        },
      },
      {
        score: { $meta: "textScore" },
      }
    )
    // Sort them
    .sort({
      score: { $meta: "textScore" },
    })
    // Limit to show 5 res only
    .limit(5);

  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);

  const q = {
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates,
        },
        $maxDistance: 10000, // 10km
      },
    },
  };

  const stores = await Store.find(q)
    .select("slug name description location photo")
    .limit(10);

  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render("map", { title: "Map" });
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map((obj) => obj.toString());
  const operator = hearts.includes(req.params.id) ? "$pull" : "$addToSet";
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      [operator]: { hearts: req.params.id },
    },
    { new: true }
  );

  // User.findOneAndUpdate();

  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts },
  });

  const count = stores.length;

  res.render("stores", { title: "Hearted Stores", stores, count });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();

  res.render("topStores", { stores, title: "Top Stores!" });
};
