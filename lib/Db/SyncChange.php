<?php

declare(strict_types=1);

namespace OCA\Taskbook\Db;

use DateTimeImmutable;
use OCP\AppFramework\Db\Entity;
use OCP\DB\Types;

/**
 * @psalm-suppress PropertyNotSetInConstructor The mapper assigns persisted values.
 * @psalm-suppress PossiblyUnusedProperty Properties are written and hydrated reflectively by Entity and QBMapper.
 * @psalm-suppress PossiblyUnusedMethod Getters are used reflectively by QBMapper.
 */
class SyncChange extends Entity {
	protected ?string $uid = null;
	protected ?string $entityType = null;
	protected ?string $clientUid = null;
	protected ?int $serverId = null;
	protected ?string $operation = null;
	protected ?int $revision = null;
	protected ?DateTimeImmutable $createdAt = null;

	public function __construct() {
		$this->addType('id', Types::BIGINT);
		$this->addType('serverId', Types::BIGINT);
		$this->addType('revision', Types::BIGINT);
		$this->addType('createdAt', Types::DATETIME_IMMUTABLE);
	}

	public function setUid(string $uid): void {
		$this->setter('uid', [$uid]);
	}
	public function setEntityType(string $entityType): void {
		$this->setter('entityType', [$entityType]);
	}
	public function getClientUid(): string {
		return $this->clientUid ?? '';
	}
	public function setClientUid(string $clientUid): void {
		$this->setter('clientUid', [$clientUid]);
	}
	public function setServerId(?int $serverId): void {
		$this->setter('serverId', [$serverId]);
	}
	public function getOperation(): string {
		return $this->operation ?? '';
	}
	public function setOperation(string $operation): void {
		$this->setter('operation', [$operation]);
	}
	public function getRevision(): int {
		return $this->revision ?? 1;
	}
	public function setRevision(int $revision): void {
		$this->setter('revision', [$revision]);
	}
	public function setCreatedAt(DateTimeImmutable $createdAt): void {
		$this->setter('createdAt', [$createdAt]);
	}
}
