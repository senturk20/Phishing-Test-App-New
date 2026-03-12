import type { CampaignStatus, RecipientStatus, EventType } from '../types';

export const campaignStatusMap: Record<CampaignStatus, { label: string; color: string }> = {
  draft:     { label: 'Taslak',        color: 'gray' },
  active:    { label: 'Aktif',         color: 'electricBlue' },
  completed: { label: 'Tamamlandi',    color: 'cyberGreen' },
  paused:    { label: 'Duraklatildi',  color: 'yellow' },
};

export const recipientStatusMap: Record<RecipientStatus, { label: string; color: string }> = {
  pending:   { label: 'Bekliyor',       color: 'gray' },
  sent:      { label: 'Gonderildi',     color: 'electricBlue' },
  clicked:   { label: 'Tikladi',        color: 'yellow' },
  submitted: { label: 'Form Gonderdi',  color: 'alertRed' },
  failed:    { label: 'Basarisiz',      color: 'alertRed' },
};

export const eventTypeMap: Record<EventType, { label: string; color: string }> = {
  opened:    { label: 'Acildi',     color: 'cyan' },
  clicked:   { label: 'Tiklandi',   color: 'yellow' },
  submitted: { label: 'Gonderildi', color: 'alertRed' },
};
