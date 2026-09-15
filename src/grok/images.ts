export interface PromptImage {
  name: string;
  mimeType: string;
  data: string;
}
export const imageUrl = (image: PromptImage) => `data:${image.mimeType};base64,${image.data}`;
export const imageContent = (images: PromptImage[]) =>
  images.map(({ mimeType, data }) => ({ type: "image", mimeType, data }));
export async function readImage(file: File): Promise<PromptImage> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("请选择 PNG、JPEG 或 WebP 图片");
  if (file.size > 5 * 1024 * 1024) throw new Error("单张图片不能超过 5 MB");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type, data };
}
