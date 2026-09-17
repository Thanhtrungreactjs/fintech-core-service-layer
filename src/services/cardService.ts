import crypto from "node:crypto";
import { cardRepository } from "../repositories/cardRepository";
import { accountService } from "./accountService";
import { Card, CardStatus, CardType } from "../types/domain";
import { Errors } from "../utils/errors";

function generateMaskedCardNumber(): string {
  const last4 = crypto.randomInt(1000, 9999);
  return `**** **** **** ${last4}`;
}

const ALLOWED_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["blocked", "expired"],
  blocked: ["active", "expired"],
  expired: [],
};

export const cardService = {
  async issue(accountId: number, cardType: CardType, expiryDate: string): Promise<Card> {
    const account = await accountService.getById(accountId);
    if (account.status !== "active") {
      throw Errors.business(
        "ACCOUNT_NOT_ACTIVE",
        `Tài khoản ${accountId} không ở trạng thái active, không thể phát hành thẻ`
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    if (expiryDate <= today) {
      throw Errors.validation(
        `Ngày hết hạn (${expiryDate}) phải sau ngày hôm nay (${today}) — không thể phát hành thẻ đã hết hạn ngay từ đầu`
      );
    }
    return cardRepository.create({
      account_id: accountId,
      card_number_masked: generateMaskedCardNumber(),
      card_type: cardType,
      expiry_date: expiryDate,
    });
  },

  async getById(id: number): Promise<Card> {
    const card = await cardRepository.findById(id);
    if (!card) throw Errors.notFound("card", id);
    return card;
  },

  async listByAccount(accountId: number): Promise<Card[]> {
    await accountService.getById(accountId);
    return cardRepository.findByAccount(accountId);
  },

  async updateStatus(id: number, status: CardStatus): Promise<Card> {
    const card = await this.getById(id);
    if (card.status === status) return card;
    if (!ALLOWED_TRANSITIONS[card.status].includes(status)) {
      throw Errors.business(
        "CARD_STATUS_TRANSITION_INVALID",
        `Không thể chuyển thẻ ${id} từ '${card.status}' sang '${status}'`
      );
    }
    await cardRepository.updateStatus(id, status);
    return this.getById(id);
  },
};
