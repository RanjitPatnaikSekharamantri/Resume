import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const RESUME_BUCKET = "resumes";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  _supabase = createClient(url, key);
  return _supabase;
}

export { getSupabase as supabase };

export function validateResumeFile(file: { name: string; size: number; type: string }) {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File size must be under 10 MB" };
  }

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: "Only PDF and DOCX files are accepted" };
  }

  const validMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
    "",
  ];
  if (file.type && !validMimes.includes(file.type)) {
    return { valid: false, error: "Invalid file type. Please upload a PDF or DOCX." };
  }

  return { valid: true, error: null };
}

export function validateFileBuffer(buffer: Buffer, ext: string): boolean {
  if (ext === ".pdf") {
    return buffer.length >= 4 && buffer.slice(0, 4).toString() === "%PDF";
  }
  if (ext === ".docx") {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }
  return false;
}

export function buildStoragePath(userId: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${Date.now()}-${sanitized}`;
}

export async function uploadResume(
  userId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ url: string; path: string }> {
  const supabase = getSupabase();
  const storagePath = buildStoragePath(userId, fileName);

  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(RESUME_BUCKET).getPublicUrl(data.path);

  return { url: publicUrl, path: data.path };
}

export async function deleteResume(storagePath: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from(RESUME_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error("Supabase delete error:", error);
    throw new Error(`Delete failed: ${error.message}`);
  }
}

export async function getSignedDownloadUrl(
  storagePath: string,
  expiresIn = 60
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.error("Supabase signed URL error:", error);
    throw new Error(`Could not generate download link: ${error.message}`);
  }

  return data.signedUrl;
}
