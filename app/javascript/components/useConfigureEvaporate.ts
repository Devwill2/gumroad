import Evaporate from "$vendor/evaporate.cjs";
import * as React from "react";

import { UploadState } from "$app/types/upload";
import { last } from "$app/utils/array";
import FileUtils from "$app/utils/file";
import { UploadStateManager } from "$app/utils/uploadStateManager";

const ROOT_BUCKET_NAME = "attachments";
const MAX_FILE_SIZE = 20 * 1024 * 1024 * 1024; // 20 GB

export type UploadProgress = { percent: number; bitrate: number };

type Props = { aws_access_key_id: string; s3_url: string; user_id: string };

export const useConfigureEvaporate = (props: Props) => {
  const bucket = last(props.s3_url.split("/"));
  // Extract the S3 endpoint from the s3_url by removing the bucket name
  // e.g., "https://s3.amazonaws.com/my-bucket" -> "https://s3.amazonaws.com"
  // e.g., "http://minio:9000/my-bucket" -> "http://minio:9000"
  const s3Endpoint = props.s3_url.substring(0, props.s3_url.lastIndexOf("/"));

  const evaporate = React.useMemo(
    () =>
      new Evaporate({
        signerUrl: Routes.s3_utility_generate_multipart_signature_path(),
        aws_key: props.aws_access_key_id,
        bucket,
        fetchCurrentServerTimeUrl: Routes.s3_utility_current_utc_time_string_path(),
        maxFileSize: MAX_FILE_SIZE,
        s3Endpoint,
        maxConcurrentParts: 3,
        partSize: 10 * 1024 * 1024,
        retryBackoffPower: 1.5,
        maxRetryBackoffSecs: 60,
        progressIntervalMS: 500,
      }),
    [props.aws_access_key_id, bucket, s3Endpoint],
  );

  const s3UploadConfig = React.useMemo(
    () => ({
      generateS3KeyForUpload: (guid: string, name: string) => {
        const s3key = FileUtils.getS3Key(
          guid,
          encodeURIComponent(name).replace("'", "%27"),
          props.user_id,
          ROOT_BUCKET_NAME,
        );
        return {
          s3key,
          fileUrl: `${props.s3_url}/${decodeURIComponent(s3key)}`,
        };
      },
    }),
    [props.s3_url, props.user_id],
  );

  const cancellationKeysToUploadIdsRef = React.useRef<Record<string, string>>({});
  const uploadStatesRef = React.useRef<Record<string, UploadState>>({});

  const calculateOptimalPartSize = (fileSize: number): number => {
    if (fileSize > 5 * 1024 * 1024 * 1024) {
      return 5 * 1024 * 1024;
    } else if (fileSize > 1024 * 1024 * 1024) {
      return 10 * 1024 * 1024;
    } else if (fileSize > 100 * 1024 * 1024) {
      return 20 * 1024 * 1024;
    }
    return 50 * 1024 * 1024;
  };

  const scheduleUpload = async ({
    cancellationKey,
    name,
    file,
    mimeType,
    onComplete,
    onProgress,
  }: {
    cancellationKey: string;
    name: string;
    file: File;
    mimeType: string;
    onComplete: () => void;
    onProgress: (progress: UploadProgress) => void;
  }) => {
    const fileId = cancellationKey.replace("file_", "");
    const existingState = UploadStateManager.load(fileId);

    if (existingState && existingState.completedParts.length > 0) {
      return await resumeUpload(existingState, onComplete, onProgress);
    }
    return startNewUpload(fileId, name, file, mimeType, onComplete, onProgress);
  };

  const startNewUpload = async (
    fileId: string,
    name: string,
    file: File,
    mimeType: string,
    onComplete: () => void,
    onProgress: (progress: UploadProgress) => void,
  ) => {
    const partSize = calculateOptimalPartSize(file.size);
    const totalParts = Math.ceil(file.size / partSize);

    const initialState: UploadState = {
      fileId,
      fileName: name,
      fileSize: file.size,
      uploadId: "",
      completedParts: [],
      totalParts,
      lastUpdated: Date.now(),
    };

    await UploadStateManager.saveFile(fileId, file);
    UploadStateManager.save(fileId, initialState);
    uploadStatesRef.current[fileId] = initialState;

    let previousProgress = 0;

    const status = evaporate.add({
      name,
      file,
      url: props.s3_url,
      mimeType,
      xAmzHeadersAtInitiate: { "x-amz-acl": "private" },
      complete: () => {
        UploadStateManager.clear(fileId);
        UploadStateManager.clearFile(fileId);
        const { [fileId]: _, ...rest } = uploadStatesRef.current;
        uploadStatesRef.current = rest;
        onComplete();
      },
      progress: (percent: number) => {
          // Calculate the bitrate of the file upload by subtracting the completed percentage from the last iteration from the current iteration percentage
        // and multiplying that by the bytesize.  I have found this to be accurate enough by comparing my upload
        // speed to the speed reported by this method.

        const progressSinceLastIteration = percent - previousProgress;
        previousProgress = percent;

        const progress = {
          percent,
          bitrate: file.size * progressSinceLastIteration,
          completedParts: Math.floor((percent / 100) * totalParts),
          totalParts,
        };

        const currentState = uploadStatesRef.current[fileId];
        if (currentState) {
          currentState.completedParts = Array.from(
            { length: Math.floor((percent / 100) * totalParts) },
            (_, i) => i + 1,
          );
          UploadStateManager.save(fileId, currentState);
        }

        onProgress(progress);
      },
      initiated: (uploadId: string) => {
        cancellationKeysToUploadIdsRef.current[`file_${fileId}`] = uploadId;

        const currentState = uploadStatesRef.current[fileId];
        if (currentState) {
          currentState.uploadId = uploadId;
          UploadStateManager.save(fileId, currentState);
        }
      },
    });

    if (typeof status === "number" && isNaN(status)) {
      return status;
    }

    return status;
  };

  const resumeUpload = async (
    state: UploadState,
    onComplete: () => void,
    onProgress: (progress: UploadProgress) => void,
  ) => {
    const file = await UploadStateManager.loadFile(state.fileId);
    if (!file) {
      throw new Error("Cannot resume upload - file not found. Please restart upload.");
    }

    const progressPercent = (state.completedParts.length / state.totalParts) * 100;

    uploadStatesRef.current[state.fileId] = state;

    if (state.completedParts.length >= state.totalParts) {
      onComplete();
      return;
    }

    let previousProgress = progressPercent;

    const status = evaporate.add({
      name: state.fileName,
      file,
      url: props.s3_url,
      mimeType: file.type,
      xAmzHeadersAtInitiate: { "x-amz-acl": "private" },
      complete: () => {
        UploadStateManager.clear(state.fileId);
        UploadStateManager.clearFile(state.fileId);
        const { [state.fileId]: _, ...rest } = uploadStatesRef.current;
        uploadStatesRef.current = rest;
        onComplete();
      },
      progress: (percent: number) => {
        const progressSinceLastIteration = percent - previousProgress;
        previousProgress = percent;

        const progress = {
          percent,
          bitrate: file.size * progressSinceLastIteration,
          completedParts: Math.floor((percent / 100) * state.totalParts),
          totalParts: state.totalParts,
        };

        const currentState = uploadStatesRef.current[state.fileId];
        if (currentState) {
          currentState.completedParts = Array.from(
            { length: Math.floor((percent / 100) * state.totalParts) },
            (_, i) => i + 1,
          );
          UploadStateManager.save(state.fileId, currentState);
        }

        onProgress(progress);
      },
      initiated: (uploadId: string) => {
        // initiated is called immediately before the uploader starts the upload of a file,
        // the uploadId here is needed for cancelling uploads (cancelling uploads requires an uploadId)
        cancellationKeysToUploadIdsRef.current[`file_${state.fileId}`] = uploadId;

        const currentState = uploadStatesRef.current[state.fileId];
        if (currentState) {
          currentState.uploadId = uploadId;
          UploadStateManager.save(state.fileId, currentState);
        }
      },
    });

    if (typeof status === "number" && isNaN(status)) {
      return status;
    }

    return status;
  };

  const cancelUpload = (cancellationKey: string) => {
    const uploadId = cancellationKeysToUploadIdsRef.current[cancellationKey];
    if (uploadId) {
      evaporate.cancel(uploadId);

      const fileId = cancellationKey.replace("file_", "");
      UploadStateManager.clear(fileId);
      UploadStateManager.clearFile(fileId);
      const { [fileId]: _, ...rest } = uploadStatesRef.current;
      uploadStatesRef.current = rest;
    }
  };

  const retryUpload = (fileId: string) => {
    const state = UploadStateManager.load(fileId);
    if (state && state.canRetry) {
      UploadStateManager.save(fileId, {
        canRetry: false,
      });
      return true;
    }
    return false;
  };

  React.useEffect(() => {
    const handleCleanup = async () => {
      try {
        await UploadStateManager.cleanup();
      } catch {

      }
    };

    handleCleanup();
  }, []);

  return { evaporateUploader: { scheduleUpload, cancelUpload, retryUpload }, s3UploadConfig };
};
