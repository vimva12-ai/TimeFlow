// 타임테이블 드래그·리사이즈에 공통으로 사용하는 타입 (PlanColumn, ActualColumn 공유)

export interface ResizeData {
  slotId: string;
  edge: 'top' | 'bottom';
  fixedOffsetMin: number; // startHour*60 기준 고정 엣지의 분 오프셋
  date: string;
}

export interface ResizePreview {
  top: number;
  height: number;
}
