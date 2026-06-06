export default function TopBar() {
  return (
    <div className="w-full bg-ink py-2 text-center leading-none [&_*]:[-webkit-font-smoothing:subpixel-antialiased]">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-[7px] h-[7px] rounded-full bg-brand-green animate-pulse" />
        <strong className="text-[#F9FAFB] font-bold text-[12px]">오늘 브리핑 업데이트 완료</strong>
        <span className="text-[#374151] text-[12px]">·</span>
        <span className="text-[#9CA3AF] text-[12px]">매일 오전 9시, 새 브리핑이 올라와요</span>
      </span>
    </div>
  )
}
