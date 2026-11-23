// The browser's position, rounded to 2 decimals (about 1 km) before it goes anywhere:
// enough to look up sunlight, without sharing exactly where a home is.
const round = (value) => Math.round(value * 100) / 100;

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser can't share its location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: round(coords.latitude), longitude: round(coords.longitude) }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied. Search for your city instead."
              : "Your location isn't available right now. Search for your city instead.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
