import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { AppError } from "@/lib/errors";
import { ALLOWED_IMAGE_FORMATS, publicIdSchema } from "./shared";

export type SignedMediaUpload = {
  uploadUrl: string;
  fields: {
    api_key: string;
    timestamp: number;
    public_id: string;
    signature: string;
    overwrite: "false";
    allowed_formats: string;
  };
};
export interface MediaProvider {
  cloudName: string;
  sign(publicId: string, timestamp: number): SignedMediaUpload;
  resource(publicId: string): Promise<unknown>;
  destroy(publicId: string): Promise<void>;
}

export function getCloudinaryProvider(): MediaProvider {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !/^[a-z0-9_-]{1,100}$/.test(cloudName) || !apiKey || !apiSecret) {
    throw new AppError(503, "Product image uploads are not connected yet.", "MEDIA_UNAVAILABLE");
  }
  const credentials = {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  };
  return {
    cloudName,
    sign(publicId, timestamp) {
      publicIdSchema.parse(publicId);
      const parameters = {
        timestamp,
        public_id: publicId,
        overwrite: "false" as const,
        allowed_formats: ALLOWED_IMAGE_FORMATS.join(","),
      };
      return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        fields: {
          ...parameters,
          api_key: apiKey,
          signature: cloudinary.utils.api_sign_request(parameters, apiSecret),
        },
      };
    },
    async resource(publicId) {
      publicIdSchema.parse(publicId);
      try {
        return await cloudinary.api.resource(publicId, {
          ...credentials,
          resource_type: "image",
          type: "upload",
          timeout: 15000,
        });
      } catch {
        throw new AppError(
          502,
          "The image could not be verified. Please retry attaching it.",
          "MEDIA_PROVIDER_ERROR",
        );
      }
    },
    async destroy(publicId) {
      publicIdSchema.parse(publicId);
      try {
        // The SDK forwards timeout/config options although its destroy overload
        // describes only the operation-specific keys.
        const options = {
          ...credentials,
          resource_type: "image" as const,
          type: "upload",
          invalidate: true,
          timeout: 15000,
        };
        const result: { result?: string } = await cloudinary.uploader.destroy(publicId, options);
        if (result.result !== "ok" && result.result !== "not found")
          throw new Error("Unexpected deletion result");
      } catch {
        throw new AppError(
          502,
          "The image could not be deleted. Its attachment lock remains active; retry deletion.",
          "MEDIA_PROVIDER_ERROR",
        );
      }
    },
  };
}
