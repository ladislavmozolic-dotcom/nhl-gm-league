const protocol = "https";
const host = "www.hockeydb.com";

const searchUrl =
  protocol +
  "://" +
  host +
  "/ihdb/stats/find_player.php?full_name=" +
  encodeURIComponent("Carpenter");

console.log(searchUrl);