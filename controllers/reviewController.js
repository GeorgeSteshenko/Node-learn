const mongoose = require("mongoose");
const Review = mongoose.model("Review");

exports.addReview = async (req, res) => {
  req.body.author = req.user._id;
  req.body.store = req.params.id;

  const newReview = new Review(req.body);
  await newReview.save();

  req.flash("success", "Review Saved!");
  res.redirect("back");
};

exports.review = async (req, res) => {
  const review = await Review.findOne({ _id: req.params.id });
  // confirmOwner(review, req.user);
  // res.json(review);
  res.render("editReview", { title: "Edit Review", review });
};

exports.editReview = async (req, res) => {
  const review = await Review.findOneAndUpdate(
    { _id: req.params.id },
    req.body,
    { new: true, runValidators: true }
  )
    .populate("store")
    .exec();

  req.flash("success", "Successfully updated your review!");

  res.redirect(`/store/${review.store.slug}`);
};

exports.deleteReview = async (req, res) => {
  // const review = await Review.findByIdAndDelete({ _id: req.params.id });
  const review = await Review.findOneAndRemove({ _id: req.params.id });

  req.flash("success", "Your review has been successfully deleted!");

  res.json(review);
};
