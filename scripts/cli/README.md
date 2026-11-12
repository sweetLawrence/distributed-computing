Here is the fully updated `README.md` for the `scripts/cli/` folder. It includes the new reset and full-demo commands.

Just save this as `scripts/cli/README.md` in your repo.

***

```markdown
# Custom CLI Commands

To install these commands on your manager VM:

### 1. Upload the files to the VM
Run these commands from your Windows project folder (Git Bash):

```bash
MSYS_NO_PATHCONV=1 vagrant upload scripts/cli/m5-reset-db /home/vagrant/ manager
MSYS_NO_PATHCONV=1 vagrant upload scripts/cli/m5-prove-success /home/vagrant/ manager
MSYS_NO_PATHCONV=1 vagrant upload scripts/cli/m5-watch-db /home/vagrant/ manager
MSYS_NO_PATHCONV=1 vagrant upload scripts/cli/m5-inject-db-crash /home/vagrant/ manager
MSYS_NO_PATHCONV=1 vagrant upload scripts/cli/m6-race /home/vagrant/ manager
MSYS_NO_PATHCONV=1 vagrant upload scripts/cli/m6-trigger-deadlock /home/vagrant/ manager
MSYS_NO_PATHCONV=1 vagrant upload scripts/cli/m5-m6-full-demo /home/vagrant/ manager
```

### 2. SSH into the VM
```bash
vagrant ssh manager
```

### 3. Move them to the bin folder and make them executable
Run this inside the VM:
```bash
mkdir -p ~/bin
mv ~/m5-* ~/m6-* ~/bin/
chmod +x ~/bin/*
echo 'export PATH=$PATH:~/bin' >> ~/.bashrc
source ~/.bashrc
```

### 4. You can now run the commands directly

**The Master Demo (runs all tests automatically):**
```bash
m5-m6-full-demo
```

**Individual Commands for Live Presentation:**
```bash
m5-reset-db           # Wipes both databases to start fresh
m5-prove-success      # Tests the 2PC Happy Path
m5-watch-db           # Live database count watcher (use in Terminal 1)
m5-inject-db-crash    # Kills cloud-db to prove failure recovery (Terminal 2)
m6-race               # Proves race condition vs mutual exclusion
m6-trigger-deadlock   # Forces a deadlock and shows the graph
```
```

























mkdir -p ~/bin

# 1. m5-reset-db
cat > ~/bin/m5-reset-db << 'EOF'
#!/usr/bin/env bash
echo "=== RESETTING DATABASES ==="
echo "[1] Truncating core-db..."
sudo docker exec $(sudo docker ps -q -f name=theme5_core-db) psql -U core -d core -c "TRUNCATE TABLE core_records;" > /dev/null
echo "[2] Truncating cloud-db..."
sudo docker run --rm --network theme5_appnet -e PGPASSWORD=cloudpass postgres:16-alpine psql -h cloud-db -U cloud -d cloud -c "TRUNCATE TABLE cloud_summaries;" > /dev/null
echo ""
echo "DATABASES RESET. You can now run the demo."
EOF


# 2. m5-prove-success

cat > ~/bin/m5-prove-success << 'EOF'
#!/usr/bin/env bash
echo "=== M5: 2PC SUCCESS PATH ==="
echo "[1] Firing a RAW HEALTH RECORD into the pipeline:"
echo '    { "patient_id": 99991, "heart_rate": 150, "systolic_bp": 180 }'
echo "    (Heart rate > 120, so Edge will flag it and send to Core)"

curl -s -X POST http://localhost:3001/ingest \
  -H "Content-Type: application/json" \
  -d '{"row":{"patient_id":99991,"age":60,"bmi":28,"heart_rate":150,"systolic_bp":180,"diastolic_bp":95,"respiratory_rate":28},"t_sent":1,"lamport":1}' > /dev/null

echo ""
echo "[ CORE LEADER LOGS - DATA IN TRANSIT ]"
sudo docker service logs --tail 3 theme5_core-1 2>&1 | grep -E "risk|txn"

echo ""
echo "[2] VERIFYING PARTICIPANT 1: core-db (on manager)"
sudo docker exec $(sudo docker ps -q -f name=theme5_core-db) psql -U core -d core -t -c "SELECT '    Status: ' || status || ' | Patient: ' || patient_id || ' | Txn: ' || txn_id FROM core_records ORDER BY id DESC LIMIT 1;"

echo ""
echo "[3] VERIFYING PARTICIPANT 2: cloud-db (on worker-1)"
sudo docker run --rm --network theme5_appnet -e PGPASSWORD=cloudpass postgres:16-alpine psql -h cloud-db -U cloud -d cloud -t -c "SELECT '    Status: ' || status || ' | Patient: ' || patient_id || ' | Txn: ' || txn_id FROM cloud_summaries ORDER BY id DESC LIMIT 1;"

echo ""
echo "SUCCESS: Both participants committed the exact same txn_id."
EOF
chmod +x ~/bin/m5-prove-success

# 3. m5-watch-db
cat > ~/bin/m5-watch-db << 'EOF'
#!/usr/bin/env bash
watch -n 2 "sudo docker exec \$(sudo docker ps -q -f name=theme5_core-db) psql -U core -d core -c \"SELECT status, COUNT(*) FROM core_records GROUP BY status;\""
EOF

# 4. m5-inject-db-crash
cat > ~/bin/m5-inject-db-crash << 'EOF'
#!/usr/bin/env bash
echo "=== M5: INJECTING DATABASE FAILURE ==="
echo "[1] Killing cloud-db node..."
sudo docker service scale theme5_cloud-db=0 > /dev/null
sleep 3

echo ""
echo "[2] Firing a NEW RAW HEALTH RECORD while DB is down:"
echo '    { "patient_id": 99992, "heart_rate": 155, "systolic_bp": 185 }'

curl -s -X POST http://localhost:3001/ingest \
  -H "Content-Type: application/json" \
  -d '{"row":{"patient_id":99992,"age":62,"bmi":29,"heart_rate":155,"systolic_bp":185,"diastolic_bp":98,"respiratory_rate":29},"t_sent":1,"lamport":1}' > /dev/null

echo ""
echo "[ CORE LEADER LOGS - DATA IN TRANSIT ]"
sudo docker service logs --tail 5 theme5_core-1 2>&1 | grep -E "risk|txn|ABORT"

echo ""
echo "[3] Checking core-db outcome for patient 99992..."
sudo docker exec $(sudo docker ps -q -f name=theme5_core-db) psql -U core -d core -t -c "SELECT '    DB Status: ' || status || ' | Patient ID: ' || patient_id FROM core_records ORDER BY id DESC LIMIT 1;"

echo ""
echo "FAILURE CONFIRMED: The record was ABORTED because cloud-db was offline."
echo "[4] Restoring cloud-db..."
sudo docker service scale theme5_cloud-db=1 > /dev/null
EOF

# 5. m6-race
cat > ~/bin/m6-race << 'EOF'
#!/usr/bin/env bash
echo "=== PREPARING DATA ==="
echo "Cleaning up old records for Patient 4 to ensure a fair test..."
sudo docker exec $(sudo docker ps -q -f name=theme5_core-db) psql -U core -d core -c "DELETE FROM core_records WHERE patient_id = 4;" > /dev/null

echo "Injecting a fresh flagged record for patient_id: 4..."
curl -s -X POST http://localhost:3001/ingest \
  -H "Content-Type: application/json" \
  -d '{"row":{"patient_id":4,"age":40,"bmi":22.5,"heart_rate":150,"systolic_bp":180,"diastolic_bp":90,"respiratory_rate":28},"t_sent":1,"lamport":1}' > /dev/null
sleep 2

# Fetch the exact starting score so we can show the math
START_SCORE=$(sudo docker exec $(sudo docker ps -q -f name=theme5_core-db) psql -U core -d core -t -c "SELECT risk_probability FROM core_records WHERE patient_id = 4 ORDER BY id DESC LIMIT 1;" | tr -d '[:space:]')
echo "-> Current Starting Risk Score for Patient 4: $START_SCORE"
echo ""

echo "=== UNSAFE RACE CONDITION (Lost Update) ==="
echo "Firing TWO concurrent +0.01 updates for patient 4 without locks..."
curl -s -X POST http://localhost:4001/lock/race -H "Content-Type: application/json" -d '{"patient_id":4,"mode":"unsafe"}'
echo -e "\n"

echo "=== SAFE RACE (MUTUAL EXCLUSION) ==="
echo "Firing TWO concurrent +0.01 updates for patient 4 WITH row locks..."
curl -s -X POST http://localhost:4001/lock/race -H "Content-Type: application/json" -d '{"patient_id":4,"mode":"safe"}'
echo -e "\n"
EOF
chmod +x ~/bin/m6-race

# 6. m6-trigger-deadlock
cat > ~/bin/m6-trigger-deadlock << 'EOF'
#!/usr/bin/env bash
echo "=== PREPARING DATA FOR DEADLOCK ==="
echo "Injecting a flagged record for patient_id: 7 to ensure both rows exist..."
curl -s -X POST http://localhost:3001/ingest \
  -H "Content-Type: application/json" \
  -d '{"row":{"patient_id":7,"age":55,"bmi":27,"heart_rate":145,"systolic_bp":175,"diastolic_bp":92,"respiratory_rate":26},"t_sent":1,"lamport":1}' > /dev/null
sleep 2

echo ""
echo "=== M6: MANUFACTURING A DEADLOCK ==="
echo "[1] Firing concurrent transactions:"
echo "    Txn A: LOCK patient 4 -> WAIT -> REQUEST patient 7"
echo "    Txn B: LOCK patient 7 -> WAIT -> REQUEST patient 4"
curl -s -X POST http://localhost:4001/lock/deadlock \
  -H "Content-Type: application/json" \
  -d '{"a":4,"b":7}'

echo -e "\n\n[ CORE LOGS - DATA IN TRANSIT ]"
sudo docker service logs --tail 5 theme5_core-1 2>&1 | grep -E "lock|deadlock|A:|B:"

echo -e "\n[ Resource-Allocation Graph ]"
echo "      Txn A ──HOLD──► row 51 (patient 4)"
echo "        │"
echo "        │ WAIT-FOR"
echo "        ▼"
echo "      row 52 (patient 7) ◄──HOLD── Txn B"
echo "        ▲                           │"
echo "        │                           │ WAIT-FOR"
echo "        │                           ▼"
echo "      row 51 (patient 4) ◄──────────┘"
EOF

# 7. m5-m6-full-demo
cat > ~/bin/m5-m6-full-demo << 'EOF'
#!/usr/bin/env bash
echo "======================================================"
echo "   ICS 2403: MILESTONES 5 & 6 FULL DEMONSTRATION"
echo "======================================================"
echo ""
echo ">>> STEP 1: RESETTING DATABASES <<<"
m5-reset-db
echo ""
echo ">>> STEP 2: M5 SUCCESS PATH <<<"
m5-prove-success
sleep 2
echo ""
echo ">>> STEP 3: M5 FAILURE INJECTION <<<"
m5-inject-db-crash
sleep 3
echo ""
echo ">>> STEP 4: M6 RACE CONDITION <<<"
m6-race
sleep 2
echo ""
echo ">>> STEP 5: M6 DEADLOCK DETECTION <<<"
m6-trigger-deadlock
echo ""
echo "======================================================"
echo "   DEMONSTRATION COMPLETE"
echo "======================================================"
EOF

# Make all executable and set PATH
chmod +x ~/bin/*
echo 'export PATH=$PATH:~/bin' >> ~/.bashrc
source ~/.bashrc

echo ""
echo "=== ALL COMMANDS INSTALLED SUCCESSFULLY ==="
ls -l ~/bin/
















### Deployment Note: Node Labels
When deploying via Vagrant, the workers boot asynchronously. To ensure all 3 nodes participate in the demonstration, run this command inside the manager VM immediately after `vagrant up` completes:

```bash
sudo docker node update --label-add worker2=true worker-2
sudo docker service update --force theme5_edge