export default function TopBar({ updatedAt }: { updatedAt?: string | null }) {
  const hasBriefing = !!updatedAt

  return (
    <div className="w-full bg-ink py-2 text-center leading-none [&_*]:[-webkit-font-smoothing:subpixel-antialiased]">
      <span className="inline-flex items-center gap-2">
        <span className={`inline-block w-[7px] h-[7px] rounded-full ${hasBriefing ? 'bg-brand-green animate-pulse' : 'bg-[#4B5563]'}`} />
        <strong className="text-[#F9FAFB] font-bold text-[12px]">
          {hasBriefing ? `오늘 ${updatedAt} 브리핑 업데이트 완료` : '브리핑 준비 중'}
        </strong>
        <span className="text-[#374151] text-[12px]">·</span>
        <span className="text-[#9CA3AF] text-[12px]">매일 오전 9시, 새 브리핑이 올라와요</span>
      </span>
    </div>
  )
}
