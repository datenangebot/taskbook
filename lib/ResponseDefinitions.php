<?php

declare(strict_types=1);

namespace OCA\Taskbook;

/**
 * @psalm-type TaskbookContext = array{id: int, title: string, icon: string, alias: string|null, revision: int, createdAt: string, updatedAt: string}
 * @psalm-type TaskbookEntry = array{
 *   id: int, text: string, type: 'task'|'appointment'|'note'|'migrated_task'|'irrelevant_task', important: bool,
 *   contextId: int, context: TaskbookContext, referenceType: 'day'|'week'|'month'|'none',
 *   primaryTargetDate: string|null, secondaryTargetDate: string|null, effectiveTargetDate: string|null,
 *   status: 'open'|'completed', completedAt: string|null, createdAt: string, updatedAt: string
 * }
 * @psalm-type TaskbookSyncEntry = array{
 *   id: int, clientUid: string, revision: int, text: string, type: 'task'|'appointment'|'note'|'migrated_task'|'irrelevant_task', important: bool,
 *   contextId: int, context: TaskbookContext, referenceType: 'day'|'week'|'month'|'none',
 *   primaryTargetDate: string|null, secondaryTargetDate: string|null, effectiveTargetDate: string|null,
 *   status: 'open'|'completed', completedAt: string|null, createdAt: string, updatedAt: string
 * }
 * @psalm-type TaskbookSettings = array{defaultContextId: int, contexts: list<TaskbookContext>, overdueReminderEnabled: bool, overdueReminderTime: string, overdueReminderDays: list<int>}
 * @psalm-type TaskbookEntryRequest = array{
 *   text: string, type: 'task'|'appointment'|'note'|'migrated_task'|'irrelevant_task', important: bool,
 *   contextId: int, referenceType: 'day'|'week'|'month'|'none', targetDate: string|null, status: 'open'|'completed'
 * }
 * @psalm-type TaskbookSyncMutation = array{
 *   operationId: string, clientUid: string, type: 'create'|'update'|'delete', baseRevision: int,
 *   entry: TaskbookEntryRequest|null
 * }
 * @psalm-type TaskbookSyncDeletion = array{clientUid: string, revision: int}
 * @psalm-type TaskbookSyncConflict = array{
 *   operationId: string, clientUid: string, baseRevision: int, serverRevision: int,
 *   reason: string, mutationType: 'create'|'update'|'delete', localEntry: TaskbookEntryRequest|null,
 *   serverEntry: TaskbookSyncEntry|null
 * }
 * @psalm-type TaskbookSyncResponse = array{
 *   canonicalChanges: list<TaskbookSyncEntry>, deletions: list<TaskbookSyncDeletion>, contexts: list<TaskbookContext>,
 *   defaultContextId: int, acknowledgedOperationIds: list<string>, conflicts: list<TaskbookSyncConflict>,
 *   nextCursor: int, hasMore: bool, serverTime: string, timezone: string, locale: string
 * }
 * @psalm-type TaskbookOverview = array{overdue: list<TaskbookEntry>, statistics: array{openItems: int, totalItemsCompleted: int, overdueItems: int, laterItems: int, migratedItems: int}}
 * @psalm-suppress UnusedClass Types are imported into the documented public controllers.
 */
final class ResponseDefinitions {
}
