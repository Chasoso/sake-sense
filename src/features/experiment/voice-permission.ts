export type VoiceStartupFailure =
  | "permission-denied"
  | "microphone-unavailable"
  | "microphone-busy"
  | "audio-initialization"
  | "unknown";

export type VoicePermissionPlatform = "ios" | "android" | "other";

function errorName(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

export function classifyVoiceCaptureError(error: unknown): VoiceStartupFailure {
  switch (errorName(error)) {
    case "NotAllowedError":
      return "permission-denied";
    case "NotFoundError":
      return "microphone-unavailable";
    case "NotReadableError":
      return "microphone-busy";
    default:
      return "unknown";
  }
}

export function classifyVoiceAudioInitializationError(): VoiceStartupFailure {
  return "audio-initialization";
}

export function getVoiceFailureMessage(failure: VoiceStartupFailure): string {
  switch (failure) {
    case "permission-denied":
      return "マイクへのアクセスが許可されていません。";
    case "microphone-unavailable":
      return "利用できるマイクが見つかりません。マイクを接続してから、もう一度試してください。";
    case "microphone-busy":
      return "マイクを開始できませんでした。他のアプリがマイクを使っていないか確認してください。";
    case "audio-initialization":
      return "音声入力の準備に失敗しました。もう一度試してください。";
    case "unknown":
      return "マイクを開始できませんでした。もう一度試してください。";
  }
}

export function getVoicePermissionPlatform(userAgent: string): VoicePermissionPlatform {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

export function getVoicePermissionGuidance(userAgent: string): string {
  switch (getVoicePermissionPlatform(userAgent)) {
    case "ios":
      return "iPhone / iPad では、Safari または iOS の Web サイト／ブラウザ設定でマイクの許可状態を確認してください。Chrome で開いている場合でも、Safari 側の Web サイト設定が影響することがあります。ブラウザアプリ自体のマイク権限も確認してください。";
    case "android":
      return "Android では、Chrome のサイト設定でこのサイトのマイク利用を許可してください。それでも使えない場合は、Android のアプリ設定で Chrome のマイク権限も確認してください。";
    default:
      return "ブラウザまたは端末の設定で、このサイトのマイク利用を許可してください。設定を変更しても反映されない場合は、ページを再読み込みしてください。";
  }
}

export type VoiceGetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

export function requestVoiceMicrophone(getUserMedia: VoiceGetUserMedia): Promise<MediaStream> {
  return getUserMedia({ audio: true });
}
