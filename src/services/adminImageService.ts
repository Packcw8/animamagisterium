import { supabase } from "../lib/supabase";

const adminImageBucket = "admin-images";

export async function pickAndUploadAdminImage(folder: string) {
  const file = await pickImageFile();
  return uploadAdminImage(file, folder);
}

async function pickImageFile() {
  if (typeof document === "undefined") {
    throw new Error("File upload is currently available in the web app.");
  }

  return new Promise<File>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No image selected."));
        return;
      }
      resolve(file);
    };
    input.click();
  });
}

async function uploadAdminImage(file: File, folder: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to upload admin images.");
  }

  const extension = file.name.split(".").pop() || "png";
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "-").replace(/^\/+|\/+$/g, "") || "general";
  const safeName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) || "image";
  const storagePath = `${user.id}/${safeFolder}/${Date.now()}-${safeName}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(adminImageBucket).upload(storagePath, file, {
    contentType: file.type || "image/png",
    upsert: true,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(adminImageBucket).getPublicUrl(storagePath);
  return data.publicUrl;
}
