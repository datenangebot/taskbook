<?php

declare(strict_types=1);

namespace OCA\Taskbook\Db;

use DateTimeImmutable;
use LogicException;
use OCP\AppFramework\Db\Entity;
use OCP\DB\Types;

/** @psalm-suppress PropertyNotSetInConstructor The mapper assigns persisted values. */
class Entry extends Entity {
	protected ?string $uid = null;
	protected ?string $clientUid = null;
	protected ?int $revision = null;
	protected ?string $text = null;
	protected ?string $type = null;
	protected bool $important = false;
	protected ?int $contextId = null;
	protected ?string $referenceType = null;
	protected ?DateTimeImmutable $primaryTargetDate = null;
	protected ?DateTimeImmutable $secondaryTargetDate = null;
	protected ?string $status = null;
	protected ?DateTimeImmutable $completedAt = null;
	protected ?DateTimeImmutable $createdAt = null;
	protected ?DateTimeImmutable $updatedAt = null;

	public function __construct() {
		$this->addType('id', Types::BIGINT);
		$this->addType('important', Types::BOOLEAN);
		$this->addType('revision', Types::BIGINT);
		$this->addType('contextId', Types::BIGINT);
		$this->addType('primaryTargetDate', Types::DATE_IMMUTABLE);
		$this->addType('secondaryTargetDate', Types::DATE_IMMUTABLE);
		$this->addType('completedAt', Types::DATETIME_IMMUTABLE);
		$this->addType('createdAt', Types::DATETIME_IMMUTABLE);
		$this->addType('updatedAt', Types::DATETIME_IMMUTABLE);
	}

	/** @psalm-suppress PossiblyUnusedMethod Called reflectively by QBMapper. */
	public function getUid(): string {
		return $this->uid ?? '';
	}

	public function setUid(string $uid): void {
		$this->setter('uid', [$uid]);
	}

	public function getClientUid(): string {
		return $this->clientUid ?? '';
	}

	public function setClientUid(string $clientUid): void {
		$this->setter('clientUid', [$clientUid]);
	}

	public function getRevision(): int {
		return $this->revision ?? 1;
	}

	public function setRevision(int $revision): void {
		$this->setter('revision', [$revision]);
	}

	public function getText(): string {
		return $this->text ?? '';
	}

	public function setText(string $text): void {
		$this->setter('text', [$text]);
	}

	public function getType(): string {
		return $this->type ?? '';
	}

	public function setType(string $type): void {
		$this->setter('type', [$type]);
	}

	public function isImportant(): bool {
		return $this->important;
	}

	public function setImportant(bool $important): void {
		$this->setter('important', [$important]);
	}

	public function getContextId(): int {
		if ($this->contextId === null) {
			throw new LogicException('contextId has not been set.');
		}

		return $this->contextId;
	}

	public function setContextId(int $contextId): void {
		$this->setter('contextId', [$contextId]);
	}

	public function getReferenceType(): string {
		return $this->referenceType ?? '';
	}

	public function setReferenceType(string $referenceType): void {
		$this->setter('referenceType', [$referenceType]);
	}

	public function getPrimaryTargetDate(): ?DateTimeImmutable {
		return $this->primaryTargetDate;
	}

	public function setPrimaryTargetDate(?DateTimeImmutable $targetDate): void {
		$this->setter('primaryTargetDate', [$targetDate]);
	}

	public function getSecondaryTargetDate(): ?DateTimeImmutable {
		return $this->secondaryTargetDate;
	}

	public function setSecondaryTargetDate(?DateTimeImmutable $targetDate): void {
		$this->setter('secondaryTargetDate', [$targetDate]);
	}

	public function getStatus(): string {
		return $this->status ?? '';
	}

	public function setStatus(string $status): void {
		$this->setter('status', [$status]);
	}

	public function getCompletedAt(): ?DateTimeImmutable {
		return $this->completedAt;
	}

	public function setCompletedAt(?DateTimeImmutable $completedAt): void {
		$this->setter('completedAt', [$completedAt]);
	}

	public function getCreatedAt(): DateTimeImmutable {
		if ($this->createdAt === null) {
			throw new LogicException('createdAt has not been set.');
		}

		return $this->createdAt;
	}

	public function setCreatedAt(DateTimeImmutable $createdAt): void {
		$this->setter('createdAt', [$createdAt]);
	}

	public function getUpdatedAt(): DateTimeImmutable {
		if ($this->updatedAt === null) {
			throw new LogicException('updatedAt has not been set.');
		}

		return $this->updatedAt;
	}

	public function setUpdatedAt(DateTimeImmutable $updatedAt): void {
		$this->setter('updatedAt', [$updatedAt]);
	}
}
