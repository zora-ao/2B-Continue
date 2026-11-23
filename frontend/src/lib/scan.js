import { APPLIANCE_TYPES } from "@/lib/appliances";

const MAX_SIDE = 1600;

// Phone photos are 3-12 MB; shrink them before upload so it's fast and cheap to read.
export async function shrinkPhoto(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file isn't a photo we can read. Try a JPG or PNG.");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the photo. Try another one."))),
      "image/jpeg",
      0.85,
    );
  });
}

export function scanToFields(result) {
  const fields = {};
  if (result.name) fields.name = result.name;
  if (result.type !== "other" && APPLIANCE_TYPES.some((item) => item.value === result.type)) {
    fields.type = result.type;
  }
  if (result.watts != null) fields.watts = String(result.watts);
  return fields;
}

export function scanErrorMessage(error) {
  if (error.status === 422) {
    return "Couldn't read the label. Try a clearer photo, or type the details.";
  }
  if (error.status === 410) {
    return "This link has expired. Make a new code on your computer.";
  }
  return error.message;
}
