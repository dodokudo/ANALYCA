export default function TemplatesTab({ userId }: { userId: string }) {
  return (
    <iframe
      title="Threads テンプレートライブラリ"
      src={`/api/templates/threads?userId=${encodeURIComponent(userId)}`}
      className="block h-[calc(100dvh-10rem)] min-h-[520px] w-full rounded-xl border border-gray-200 bg-white lg:h-[calc(100dvh-3rem)]"
    />
  );
}
