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
class SyncOperation extends Entity {
	protected ?string $uid = null;
	protected ?string $installationId = null;
	protected ?string $operationId = null;
	protected ?string $resultJson = null;
	protected ?DateTimeImmutable $createdAt = null;

	public function __construct() {
		$this->addType('id', Types::BIGINT);
		$this->addType('createdAt', Types::DATETIME_IMMUTABLE);
	}

	public function setUid(string $uid): void {
		$this->setter('uid', [$uid]);
	}
	public function setInstallationId(string $installationId): void {
		$this->setter('installationId', [$installationId]);
	}
	public function setOperationId(string $operationId): void {
		$this->setter('operationId', [$operationId]);
	}
	public function getResultJson(): string {
		return $this->resultJson ?? '';
	}
	public function setResultJson(string $resultJson): void {
		$this->setter('resultJson', [$resultJson]);
	}
	public function setCreatedAt(DateTimeImmutable $createdAt): void {
		$this->setter('createdAt', [$createdAt]);
	}
}
