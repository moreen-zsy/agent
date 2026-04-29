/**
 * A2UI Video 组件
 */

export interface VideoProps {
  url: string;
}

export function A2UIVideo({ url }: VideoProps) {
  return (
    <video controls className="w-full rounded-lg">
      <source src={url} />
      Your browser does not support the video tag.
    </video>
  );
}
