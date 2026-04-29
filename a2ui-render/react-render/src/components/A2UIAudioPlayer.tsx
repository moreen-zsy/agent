/**
 * A2UI AudioPlayer 组件
 */

export interface AudioPlayerProps {
  url: string;
  description?: string;
}

export function A2UIAudioPlayer({ url, description }: AudioPlayerProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
      {description && <span className="text-sm text-gray-600">{description}</span>}
      <audio controls className="w-full">
        <source src={url} />
        Your browser does not support the audio tag.
      </audio>
    </div>
  );
}
