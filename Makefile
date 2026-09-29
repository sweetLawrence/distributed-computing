up:
	MSYS_NO_PATHCONV=1 docker compose up -d --build

down:
	MSYS_NO_PATHCONV=1 docker compose down

logs:
	MSYS_NO_PATHCONV=1 docker compose logs -f --tail=100

ps:
	docker compose ps

baseline:
	sed -i 's/FORCE_FORWARD: "0"/FORCE_FORWARD: "1"/' docker-compose.yml
	MSYS_NO_PATHCONV=1 docker compose up -d --build --force-recreate edge-1 edge-2
	@sleep 3
	curl -X POST http://localhost:3000/stats/reset
	curl -X POST http://localhost:3000/start
	@sleep 45
	curl http://localhost:3000/stats > results/baseline.json
	@cat results/baseline.json

proposed:
	sed -i 's/FORCE_FORWARD: "1"/FORCE_FORWARD: "0"/' docker-compose.yml
	MSYS_NO_PATHCONV=1 docker compose up -d --build --force-recreate edge-1 edge-2
	@sleep 3
	curl -X POST http://localhost:3000/stats/reset
	curl -X POST http://localhost:3000/start
	@sleep 45
	curl http://localhost:3000/stats > results/proposed.json
	@cat results/proposed.json

kill-core:
	docker kill distributed-edge-platform-core-2-1

watchdog:
	@curl -s http://localhost:3001/watchdog

.PHONY: up down logs ps baseline proposed kill-core watchdog
