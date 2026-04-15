import { randomUUID } from "crypto";

import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase";

type UploadOptions = {
  userId: string;
  category: "base-resumes" | "resume-versions" | "cover-letters";
  fileName: string;
  file: File | Blob;
  contentType?: string;
};

export async function uploadUserDocument({
  userId,
  category,
  fileName,
  file,
  contentType,
}: UploadOptions) {
  const supabase = getSupabaseAdmin();
  const safeName = fileName.replace(/\s+/g, "-").toLowerCase();
  const path = `${userId}/${category}/${Date.now()}-${randomUUID()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return data.path;
}

export async function removeUserDocument(storagePath: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
}

export async function uploadFileToStorage({
  userId,
  file,
  prefix,
}: {
  userId: string;
  file: File | Blob;
  prefix: "base-resumes" | "resume-versions" | "cover-letters";
}) {
  const fileName = file instanceof File ? file.name : `${prefix}-${Date.now()}`;
  const contentType = file instanceof File ? file.type : "application/octet-stream";

  const path = await uploadUserDocument({
    userId,
    category: prefix,
    fileName,
    file,
    contentType,
  });

  return { path };
}

export async function removeStorageObject(storagePath: string) {
  await removeUserDocument(storagePath);
}
