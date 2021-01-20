import axios from "axios";

function ajaxDelete(e) {
  e.preventDefault();

  axios
    .delete(this.action)
    .then((res) => {
      console.log(res.data);
      window.location = window.location.href;
    })
    .catch((err) => console.error(err));
}

export default ajaxDelete;
