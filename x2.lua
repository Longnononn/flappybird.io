-- =========================================
-- ============ CONFIG & SERVICES ============
-- =========================================
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TeleportService = game:GetService("TeleportService")
local StarterGui = game:GetService("StarterGui")
local CoreGui = game:GetService("CoreGui")
local VirtualUser = game:GetService("VirtualUser")
local HttpService = game:GetService("HttpService")
local Workspace = game:GetService("Workspace")

local LocalPlayer = Players.LocalPlayer
-- If this script could run before LocalPlayer exists, wait for it:
if not LocalPlayer then
    LocalPlayer = Players.LocalPlayer or Players:GetPropertyChangedSignal("LocalPlayer") and Players.LocalPlayer or Players:WaitForChild("LocalPlayer")
end

-- ================= Logger =================
local Log = {}
local _oldPrint = print
local _oldWarn = warn
local _oldError = error

local function timest() return os.date("%Y-%m-%d %H:%M:%S") end

function Log.raw(level, ...)
    local parts = {}
    for i = 1, select("#", ...) do
        local v = select(i, ...)
        parts[#parts+1] = tostring(v)
    end
    local msg = table.concat(parts, " ")
    local final = string.format("[%s] [%s] %s", timest(), level, msg)
    _oldPrint(final)
end
function Log.info(...)  Log.raw("INFO", ...)  end
function Log.warn(...)  Log.raw("WARN", ...)  end
function Log.error(...) Log.raw("ERROR", ...) end
function Log.debug(...) Log.raw("DEBUG", ...) end

-- Helper to print StatusLabel updates
local function BindStatusLogger(statusLabel)
    if not statusLabel then return end
    -- Wrap a setter: whenever script sets StatusLabel.Text it should call Log.info
    -- We will not override metatables; instead we will call Log when script updates StatusLabel.Text.
    -- (Later in code we call UpdateStatus function to set StatusLabel.Text and log)
end

-- =========================================
local Config = {
    ScriptName = "Long Dzz Hub v17 (STABLE EDITION)",
    KeyFileName = "LongDzzHubKey.txt",
    WorkerVerifyURL = "https://key-flow.longnononpro.workers.dev/api/check?key=",
    TeamToJoin = getgenv().Team or "Marines",
    ChestSearchTerm = "Chest",
    FruitSearchTerm = "Fruit",
    RemotesFolder = (ReplicatedStorage:FindFirstChild("Remotes") or ReplicatedStorage),
    LootRemotes = {"CommF_", "CommC_", "RemoteEventA279", "commF_"},
    TeleportOffset = Vector3.new(0, 7, 0),
    MicroDelay = 0.2,
    LootCountBeforeReset = 10,
    HopInterval = 180,
    MaxLootBeforeHop = 300,
    StoreFruitRemoteName = "StorageHandler",
    WorkingEquipRemote = nil,
    EquipCommands = {"EquipItem", "EquipTool", "Melee", "Sword", "Gun", "Fruit"},
    EquipRemotes = {"CommF_", "CommC_", "RemoteEventA279", "commF_", "InventoryHandler", "ItemUse"},
    SpamEquipInterval = 0.3,
    NotableItems = { ["Fist of Darkness"] = true, ["God's Chalice"] = true, }
}

getgenv().Team = Config.TeamToJoin
getgenv().UserKey = getgenv().UserKey or ""
getgenv().AutoStopItemEnabled = false
getgenv().NotableItemFound = false
getgenv().AntiAFKEnabled = true
getgenv().SpamEquipEnabled = true
getgenv().LootCounter = 0
local scriptPaused = false

local CommF_Remote = nil
local StoreFruit_Remote = nil
local TOGGLE_WIDTH = 250

-- Prepare GUI toggles container (safe: CoreGui can be restricted on some clients)
if CoreGui:FindFirstChild("Grai_Toggles") then
    CoreGui.Grai_Toggles:Destroy()
end
local successGui, gui2 = pcall(function()
    local g = Instance.new("ScreenGui", CoreGui)
    g.Name = "Grai_Toggles"
    g.DisplayOrder = 20
    return g
end)
if not successGui then
    Log.warn("Unable to create toggles GUI in CoreGui; permissions may be restricted.")
    gui2 = Instance.new("ScreenGui")
    gui2.Name = "Grai_Toggles"
    gui2.Parent = LocalPlayer:FindFirstChild("PlayerGui") or LocalPlayer:WaitForChild("PlayerGui")
end

local toggleIndex = 0

-- =========================================
-- ============ UTILITY FUNCTIONS ============
-- =========================================
local function UpdateStatusLabel(statusLabel, txt)
    if statusLabel and statusLabel:IsA("TextLabel") then
        statusLabel.Text = txt
    end
    Log.info("Status:", txt)
end

local function Notify(title, text)
    pcall(function()
        StarterGui:SetCore("SendNotification", {
            Title = title or Config.ScriptName,
            Text = text,
            Duration = 5
        })
    end)
    Log.info("Notify:", title or Config.ScriptName, "-", text)
end

local function saveKey(key)
    if writefile then pcall(writefile, Config.KeyFileName, key) else Log.warn("writefile not available; key not saved.") end
end

local function loadKey()
    if readfile then
        local success, key = pcall(readfile, Config.KeyFileName)
        if success and key then return key end
        return ""
    end
    return ""
end

local function HideKeyUI(mainFrame, isHiding)
    if not mainFrame then return end
    local keyBox = mainFrame:FindFirstChild("KeyBox")
    local submitButton = mainFrame:FindFirstChild("SubmitButton")
    local linkButton = mainFrame:FindFirstChild("LinkButton")

    if keyBox then keyBox.Visible = not isHiding end
    if submitButton then submitButton.Visible = not isHiding end
    if linkButton then linkButton.Visible = not isHiding end

    if isHiding then
        local parentGui = mainFrame.Parent
        if parentGui then parentGui:Destroy() end
        Log.info("Key UI hidden.")
    end
end

local function WaitForRespawn()
    local newChar = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
    local ok, hRoot = pcall(function() return newChar:WaitForChild("HumanoidRootPart", 5) end)
    if ok and hRoot then
        task.wait(0.5)
        return true
    end
    return false
end

local function SmartReset()
    local char = LocalPlayer.Character
    if char and char:FindFirstChild("Humanoid") and char.Humanoid.Health > 0 then
        char.Humanoid.Health = 0
        WaitForRespawn()
        return true
    end
    WaitForRespawn()
    return false
end

local function HopToNextServer()
    Notify(nil, "Bắt đầu quét server để Hop...")
    SmartReset()

    local placeId = game.PlaceId
    pcall(function()
        if TeleportService.GetServers then
            local ok, servers = pcall(function() return TeleportService:GetServers(placeId) end)
            if ok and type(servers) == "table" then
                local targetJobId = nil
                for i, server in ipairs(servers) do
                    if type(server) == "table" and server.Playing and server.JobId and server.Playing < 5 and server.JobId ~= game.JobId then
                        targetJobId = server.JobId
                        Notify("Auto-Hop", "✅ Đã tìm thấy Server trống (" .. tostring(server.Playing) .. " người).")
                        break
                    end
                end
                if targetJobId then
                    TeleportService:TeleportToPlaceInstance(placeId, targetJobId, LocalPlayer)
                    return
                end
            end
        end
        Notify("Auto-Hop", "⚠️ Không tìm thấy server trống / GetServers không khả dụng. Đang Teleport ngẫu nhiên.")
        TeleportService:Teleport(placeId)
    end)
end

local function EnsureTeam()
    local player = Players.LocalPlayer
    local targetTeam = Config.TeamToJoin
    if player.Team and player.Team.Name == targetTeam then return end

    Notify(nil, "⏳ Tham gia team: "..tostring(targetTeam))
    local args = {[1]="SetTeam",[2]=targetTeam}
    pcall(function()
        if CommF_Remote then
            if CommF_Remote:IsA("RemoteFunction") then
                CommF_Remote:InvokeServer(unpack(args))
            elseif CommF_Remote:IsA("RemoteEvent") then
                CommF_Remote:FireServer(unpack(args))
            end
        else
            Log.warn("EnsureTeam: CommF_Remote is nil; can't set team remotely.")
        end
    end)
    task.wait(0.5)
end

local function KeyVerificationProcess(key, StatusLabel, MainFrame)
    UpdateStatusLabel(StatusLabel, "Status: Đang gửi yêu cầu (HttpGet)...")
    local url = Config.WorkerVerifyURL .. key

    local success, rawResponse = pcall(function()
        if HttpService and HttpService.RequestAsync then
            local ok, req = pcall(function()
                return HttpService:RequestAsync({Url = url, Method = "GET"})
            end)
            if ok and req and req.Success and req.Body then
                return req.Body
            end
        end

        if (type(game.HttpGet) == "function") then
            local ok2, res = pcall(function() return game.HttpGet(url) end)
            if ok2 then return res end
        end

        if key == "testkey123" then
            return '{"valid": true, "expires_in_seconds": 3600}'
        else
            return '{"valid": false, "error": "Key không hợp lệ."}'
        end
    end)

    if success and rawResponse and type(rawResponse) == "string" and #rawResponse > 0 then
        local data_success, data = pcall(HttpService.JSONDecode, HttpService, rawResponse)
        if data_success and type(data) == "table" and data.valid ~= nil then
            if data.valid then
                getgenv().UserKey = key
                saveKey(key)
                UpdateStatusLabel(StatusLabel, "Status: Key hợp lệ. Bắt đầu farm.")
                if MainFrame then HideKeyUI(MainFrame, true) end
                return true
            else
                UpdateStatusLabel(StatusLabel, "Status: "..(data.error or "Key không hợp lệ"))
                if MainFrame then HideKeyUI(MainFrame, false) end
                return false
            end
        end
    end

    UpdateStatusLabel(StatusLabel, "Status: Lỗi kết nối/Kiểm tra key thất bại.")
    if MainFrame then HideKeyUI(MainFrame, false) end
    return false
end

local function FindLootRemote()
    for _, name in ipairs(Config.LootRemotes) do
        local remote = Config.RemotesFolder:FindFirstChild(name)
        if remote and (remote:IsA("RemoteFunction") or remote:IsA("RemoteEvent")) then
            return remote
        end
    end
    return nil
end

local function FindStoreFruitRemote()
    local remote = Config.RemotesFolder:FindFirstChild(Config.StoreFruitRemoteName)
    if remote and (remote:IsA("RemoteFunction") or remote:IsA("RemoteEvent")) then
        return remote
    else
        return nil
    end
end

local function callRemote(remote, ...)
    if not remote then return end
    pcall(function()
        if remote:IsA("RemoteFunction") then
            remote:InvokeServer(...)
        elseif remote:IsA("RemoteEvent") then
            remote:FireServer(...)
        end
    end)
end

local function FindWorkingEquipRemote()
    Notify("Equip Solver", "Đang tìm Remote Equip đang hoạt động...")
    for _, remoteName in ipairs(Config.EquipRemotes) do
        local remote = Config.RemotesFolder:FindFirstChild(remoteName)
        if remote then
            for _, cmdName in ipairs(Config.EquipCommands) do
                local ok = pcall(function()
                    if remote:IsA("RemoteFunction") then
                        remote:InvokeServer(cmdName)
                    elseif remote:IsA("RemoteEvent") then
                        remote:FireServer(cmdName)
                    end
                end)
                if ok then
                    Config.WorkingEquipRemote = remote
                    Notify("Equip Solver", "✅ Đã tìm thấy Remote Equip: " .. remote.Name .. " (Thành công với lệnh: " .. cmdName .. ")")
                    return
                end
            end
        end
    end
    if CommF_Remote then
        Notify("Equip Solver", "⚠️ Không tìm thấy Remote Equip chuyên dụng, dùng Remote Loot: " .. CommF_Remote.Name)
        Config.WorkingEquipRemote = CommF_Remote
    else
        Notify("Equip Solver", "❌ LỖI: Không tìm thấy Remote Equip.")
    end
end

-- =========================================
-- ============ EQUIP/LOOT LOGIC ============
-- =========================================

local function FastEquipTool()
    local remoteToUse = Config.WorkingEquipRemote
    if not remoteToUse then return false end

    for _, cmdName in ipairs(Config.EquipCommands) do
        pcall(function() callRemote(remoteToUse, cmdName) end)
    end
    task.wait(Config.MicroDelay)

    for _, item in ipairs(LocalPlayer.Backpack:GetChildren()) do
        if item:IsA("Tool") and item.Name ~= Config.FruitSearchTerm then
            pcall(function() callRemote(remoteToUse, "EquipItem", item) end)
            pcall(function() callRemote(remoteToUse, "EquipTool", item) end)
            break
        end
    end
    return true
end

local function SpamEquipItems()
    local remoteToUse = Config.WorkingEquipRemote
    if not remoteToUse then return end

    local allItems = {}
    for _, item in ipairs(LocalPlayer.Backpack:GetChildren()) do
        if item:IsA("Tool") and item.Name ~= Config.FruitSearchTerm then table.insert(allItems, item.Name) end
    end
    if LocalPlayer.Character then
        for _, item in ipairs(LocalPlayer.Character:GetChildren()) do
            if item:IsA("Tool") and item.Name ~= Config.FruitSearchTerm then table.insert(allItems, item.Name) end
        end
    end

    local uniqueItems = {}
    local seen = {}
    for _, name in ipairs(allItems) do
        if not seen[name] then
            uniqueItems[#uniqueItems + 1] = name
            seen[name] = true
        end
    end

    if #uniqueItems < 2 then task.wait(Config.SpamEquipInterval); return end

    for _, itemName in ipairs(uniqueItems) do
        if not getgenv().SpamEquipEnabled or scriptPaused then break end
        for _, cmdName in ipairs(Config.EquipCommands) do
            pcall(function() callRemote(remoteToUse, cmdName) end)
        end
        pcall(function() callRemote(remoteToUse, "EquipItem", itemName) end)
        pcall(function() callRemote(remoteToUse, "EquipTool", itemName) end)
        task.wait(Config.SpamEquipInterval)
    end
end

local function TeleportAndLoot(targetPart, lootType)
    if not targetPart or not targetPart:IsA("BasePart") then return end
    local char = LocalPlayer.Character
    local hRoot = char and char:FindFirstChild("HumanoidRootPart")
    if not hRoot then return end

    local originalGravity = Workspace.Gravity
    local human = char:FindFirstChildOfClass("Humanoid")
    local originalWalkSpeed = human and human.WalkSpeed or 16

    Workspace.Gravity = 0
    if human then human.WalkSpeed = 100 end

    FastEquipTool()
    hRoot.CFrame = CFrame.new(targetPart.Position + Config.TeleportOffset)
    task.wait(Config.MicroDelay)
    pcall(function() callRemote(CommF_Remote, lootType, targetPart) end)
    getgenv().LootCounter = getgenv().LootCounter + 1
    task.wait(Config.MicroDelay)

    Workspace.Gravity = originalGravity
    if human then human.WalkSpeed = originalWalkSpeed end
end

local function CheckForNotableItemsInInventory()
    for _, item in ipairs(LocalPlayer.Backpack:GetChildren()) do
        if Config.NotableItems[item.Name] then
            getgenv().NotableItemFound = true
            return true
        end
    end
    if LocalPlayer.Character then
        for _, item in ipairs(LocalPlayer.Character:GetChildren()) do
            if item:IsA("Tool") and Config.NotableItems[item.Name] then
                getgenv().NotableItemFound = true
                return true
            end
        end
    end
    return false
end

local function TryStoreFruit()
    if StoreFruit_Remote then
        for _, item in ipairs(LocalPlayer.Backpack:GetChildren()) do
            if item.Name == Config.FruitSearchTerm then
                pcall(function() callRemote(StoreFruit_Remote, item, item.Name) end)
                Notify("Auto-Store", "Đã tìm và lưu Trái Ác Quỷ.")
                task.wait(0.1)
                return
            end
        end
    end
end

-- Improved ScanWorkspace (fixed skipping logic)
local function ScanWorkspace()
    local fruits = {}
    local chests = {}
    local rootPosition = LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart") and LocalPlayer.Character.HumanoidRootPart.Position or Vector3.new(0,0,0)

    for _, obj in ipairs(Workspace:GetDescendants()) do
        local candidatePart = nil

        if obj:IsA("BasePart") then
            candidatePart = obj
        elseif obj:IsA("Model") then
            candidatePart = obj:FindFirstChild("Part") or obj:FindFirstChild("Handle") or obj.PrimaryPart
            if not candidatePart then
                for _, child in ipairs(obj:GetChildren()) do
                    if child:IsA("BasePart") then
                        candidatePart = child
                        break
                    end
                end
            end
        end

        if not candidatePart or not candidatePart:IsA("BasePart") then
            -- skip
        else
            -- distance check: skip far objects
            if (candidatePart.Position - rootPosition).Magnitude > 500 then
                -- skip far away
            else
                local parentModel = candidatePart:FindFirstAncestorWhichIsA and candidatePart:FindFirstAncestorWhichIsA("Model")
                local nameToCheck = (parentModel and parentModel.Name) or candidatePart.Name

                if tostring(nameToCheck):match(Config.FruitSearchTerm) then
                    table.insert(fruits, candidatePart)
                elseif tostring(candidatePart.Name):match(Config.ChestSearchTerm) or tostring(nameToCheck):match(Config.ChestSearchTerm) then
                    if not candidatePart:IsDescendantOf(LocalPlayer.Character or {}) and not candidatePart:IsDescendantOf(LocalPlayer.Backpack or {}) then
                        table.insert(chests, candidatePart)
                    end
                end
            end
        end
    end

    return fruits, chests
end

local function CollectFruits(fruits)
    if #fruits > 0 then
        Notify("⚠️ FRUIT SPOTTED", "Đang nhặt " .. #fruits .. " Trái Ác Quỷ.")
        for _, fruitPart in ipairs(fruits) do
            if getgenv().AutoStopItemEnabled and getgenv().NotableItemFound then break end
            TeleportAndLoot(fruitPart, "PickUpItem")
            TryStoreFruit()
            if getgenv().AutoStopItemEnabled and CheckForNotableItemsInInventory() then break end
            task.wait(Config.MicroDelay)
        end
        return #fruits
    end
    return 0
end

local function CollectChests(chests)
    if #chests == 0 then return 0 end
    Notify("Auto-Loot", "Đã tìm thấy " .. #chests .. " rương. Bắt đầu nhặt.")
    local chestsFound = 0
    for _, chest in ipairs(chests) do
        if getgenv().AutoStopItemEnabled and getgenv().NotableItemFound then return chestsFound end
        TeleportAndLoot(chest, "LootChest")
        chestsFound = chestsFound + 1
        if getgenv().AutoStopItemEnabled and CheckForNotableItemsInInventory() then return chestsFound end
    end
    return chestsFound
end

-- =========================================
-- ============ GUI LOGIC (Key UI) ============
-- =========================================

local function CreateMainGUI(initialKey, checkKeyCallback)
    if LocalPlayer.PlayerGui:FindFirstChild("LongDzzMainHub") then LocalPlayer.PlayerGui.LongDzzMainHub:Destroy() end

    local MainGui = Instance.new("ScreenGui")
    MainGui.Name = "LongDzzMainHub"
    MainGui.Parent = LocalPlayer.PlayerGui

    local MainFrame = Instance.new("Frame")
    MainFrame.Name = "HubFrame"
    MainFrame.Size = UDim2.new(0, 360, 0, 240)
    MainFrame.Position = UDim2.new(0.5, -180, 0.1, 0)
    MainFrame.BackgroundTransparency = 1
    MainFrame.Parent = MainGui

    local Background = Instance.new("ImageLabel", MainFrame)
    Background.Size = UDim2.new(1,0,1,0)
    Background.BackgroundColor3 = Color3.fromRGB(50,50,50)
    Background.Image = "rbxassetid://86660811087803"
    Background.ScaleType = Enum.ScaleType.Stretch
    Instance.new("UICorner", Background).CornerRadius = UDim.new(0,8)

    local TitleLabel = Instance.new("TextLabel", MainFrame)
    TitleLabel.Size = UDim2.new(1,0,0,30)
    TitleLabel.BackgroundTransparency = 1
    TitleLabel.Font = Enum.Font.SourceSansBold
    TitleLabel.TextSize = 18
    TitleLabel.TextColor3 = Color3.new(1,1,1)
    TitleLabel.Text = Config.ScriptName

    local CloseButton = Instance.new("TextButton", MainFrame)
    CloseButton.Size = UDim2.new(0, 30, 0, 30)
    CloseButton.Position = UDim2.new(1, -30, 0, 0)
    CloseButton.BackgroundColor3 = Color3.fromRGB(200, 0, 0)
    CloseButton.TextColor3 = Color3.new(1, 1, 1)
    CloseButton.Text = "X"
    CloseButton.Font = Enum.Font.SourceSansBold
    CloseButton.TextSize = 18
    CloseButton.MouseButton1Click:Connect(function() MainGui:Destroy(); Notify(nil, "GUI đã được đóng.") end)

    local KeyBox = Instance.new("TextBox", MainFrame)
    KeyBox.Name = "KeyBox"
    KeyBox.Size = UDim2.new(0, 200, 0, 30)
    KeyBox.Position = UDim2.new(0, 10, 0, 50)
    KeyBox.PlaceholderText = "Nhập key..."
    KeyBox.Text = initialKey or ""
    KeyBox.BackgroundColor3 = Color3.fromRGB(80,80,80)
    KeyBox.TextColor3 = Color3.new(1,1,1)

    local LinkButton = Instance.new("TextButton", MainFrame)
    LinkButton.Name = "LinkButton"
    LinkButton.Size = UDim2.new(0, 120, 0, 30)
    LinkButton.Position = UDim2.new(0, 220, 0, 50)
    LinkButton.Text = "Lấy Link /start"
    LinkButton.BackgroundColor3 = Color3.fromRGB(0,150,255)
    LinkButton.TextColor3 = Color3.new(1,1,1)
    LinkButton.MouseButton1Click:Connect(function()
        pcall(function() setclipboard("https://key-flow.longnononpro.workers.dev/start") end)
        Notify(nil, "Đã copy link rút gọn vào clipboard!")
    end)

    local SubmitButton = Instance.new("TextButton", MainFrame)
    SubmitButton.Name = "SubmitButton"
    SubmitButton.Size = UDim2.new(0, 120, 0, 30)
    SubmitButton.Position = UDim2.new(0, 10, 0, 90)
    SubmitButton.Text = "Submit Key"
    SubmitButton.BackgroundColor3 = Color3.fromRGB(0,200,0)
    SubmitButton.TextColor3 = Color3.new(1,1,1)

    local StatusLabel = Instance.new("TextLabel", MainFrame)
    StatusLabel.Size = UDim2.new(1,0,0,30)
    StatusLabel.Position = UDim2.new(0,0,0,140)
    StatusLabel.BackgroundTransparency = 1
    StatusLabel.Font = Enum.Font.SourceSansItalic
    StatusLabel.TextSize = 14
    StatusLabel.TextColor3 = Color3.fromRGB(0,255,127)
    StatusLabel.Text = "Status: Chưa kiểm tra key"

    SubmitButton.MouseButton1Click:Connect(function()
        local inputKey = KeyBox.Text
        if inputKey and inputKey ~= "" then
            checkKeyCallback(inputKey, StatusLabel, MainFrame)
        else
            Notify(nil, "Vui lòng nhập key!")
        end
    end)

    return StatusLabel, MainFrame, KeyBox
end

-- =========================================
-- ============ GUI LOGIC (Toggles) ============
-- =========================================

local function createSingleToggle(name, default, callback)
    toggleIndex = toggleIndex + 1

    local container = Instance.new("Frame", gui2)
    container.Size = UDim2.new(0, TOGGLE_WIDTH, 0, 35)
    container.Position = UDim2.new(1, -5 - TOGGLE_WIDTH, 0.2, (toggleIndex - 1) * 40)
    container.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
    container.BackgroundTransparency = 0.2
    Instance.new("UICorner", container).CornerRadius = UDim.new(0, 8)

    local btn = Instance.new("TextButton", container)
    btn.Size = UDim2.new(0, 20, 0, 20)
    btn.Position = UDim2.new(1, -30, 0.5, -10)

    local state = default
    local function update()
        if state then
            btn.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
            btn.Text = "✔"
        else
            btn.BackgroundColor3 = Color3.fromRGB(150, 150, 150)
            btn.Text = ""
        end
    end
    update()

    btn.MouseButton1Click:Connect(function()
        state = not state
        update()
        callback(state)
    end)

    local label = Instance.new("TextLabel", container)
    label.Size = UDim2.new(1, -35, 0, 20)
    label.Position = UDim2.new(0, 5, 0.5, -10)
    label.BackgroundTransparency = 1
    label.Text = name
    label.TextColor3 = Color3.fromRGB(255, 255, 255)
    label.Font = Enum.Font.Gotham
    label.TextSize = 14
    label.TextXAlignment = Enum.TextXAlignment.Left

    return container
end

createSingleToggle("Equip Spam (Liên tục đổi Item)", getgenv().SpamEquipEnabled, function(st)
    getgenv().SpamEquipEnabled = st
    Notify("Spam Equip", st and "Chức năng Spam Equip BẬT." or "Chức năng Spam Equip TẮT.")
end)

createSingleToggle("Stop: Chalice/Fist (Dừng An Toàn)", getgenv().AutoStopItemEnabled, function(st)
    getgenv().AutoStopItemEnabled = st
    if st then
        Notify("Safety", "Công tắc an toàn BẬT. Sẽ TẠM DỪNG nếu tìm thấy vật phẩm hiếm.")
    else
        Notify("Safety", "Công tắc an toàn TẮT. Vòng lặp sẽ tiếp tục farm.")
        getgenv().NotableItemFound = false
        scriptPaused = false
    end
end)

-- =========================================
-- ============ MAIN EXECUTION =============
-- =========================================

local savedKey = loadKey()
local StatusLabel, MainFrame, KeyBox = CreateMainGUI(savedKey, KeyVerificationProcess)

if savedKey and savedKey ~= "" then
    UpdateStatusLabel(StatusLabel, "Status: Đang tự động kiểm tra key đã lưu...")
    KeyVerificationProcess(savedKey, StatusLabel, MainFrame)
end

-- Anti-AFK
task.spawn(function()
    pcall(function()
        LocalPlayer.Idled:Connect(function()
            if getgenv().AntiAFKEnabled then
                VirtualUser:Button2Down(Vector2.new(0,0), workspace.CurrentCamera.CFrame)
                task.wait(1)
                VirtualUser:Button2Up(Vector2.new(0,0), workspace.CurrentCamera.CFrame)
            end
        end)
    end)
    while true do
        task.wait(15)
        if getgenv().AntiAFKEnabled and not (getgenv().AutoStopItemEnabled and getgenv().NotableItemFound) then
            pcall(function()
                VirtualUser:KeyDown(Enum.KeyCode.Space)
                task.wait(0.1)
                VirtualUser:KeyUp(Enum.KeyCode.Space)
            end)
        end
    end
end)

-- Spam equip loop
task.spawn(function()
    while not getgenv().UserKey or getgenv().UserKey == "" do task.wait(2) end
    if not Config.WorkingEquipRemote then FindWorkingEquipRemote() end
    while true do
        if getgenv().SpamEquipEnabled and not scriptPaused then
            SpamEquipItems()
        else
            task.wait(0.5)
        end
    end
end)

-- Auto-loot loop
task.spawn(function()
    while not getgenv().UserKey or getgenv().UserKey == "" do
        UpdateStatusLabel(StatusLabel, "Status: Chưa có key, vui lòng nhập key! (Đang chờ)")
        task.wait(2)
    end

    Notify(nil, "✅ Key hợp lệ! Bắt đầu vòng lặp Loot Chest/Fruit.")

    CommF_Remote = FindLootRemote()
    StoreFruit_Remote = FindStoreFruitRemote()
    FindWorkingEquipRemote()

    if not CommF_Remote then
        Notify("LỖI CRITICAL", "Không tìm thấy Remote Loot. Script không thể chạy.")
        return
    end

    UpdateStatusLabel(StatusLabel, "Status: Waiting for initial game load...")
    task.wait(3)

    UpdateStatusLabel(StatusLabel, "Status: Selecting team...")
    EnsureTeam()
    task.wait(0.1)

    local lastHopTime = tick()

    while true do
        if getgenv().AutoStopItemEnabled and getgenv().NotableItemFound then
            if not scriptPaused then
                Notify("🛑 ĐÃ DỪNG AN TOÀN", "Vòng lặp đã DỪNG do tìm thấy vật phẩm hiếm.")
                scriptPaused = true
                UpdateStatusLabel(StatusLabel, "Status: DỪNG AN TOÀN (Item Found in Inventory)")
            end
            task.wait(3)
        else
            scriptPaused = false
            local timeRemaining = math.ceil(Config.HopInterval - (tick() - lastHopTime))
            local lootProgress = tostring(getgenv().LootCounter) .. "/" .. tostring(Config.MaxLootBeforeHop)
            UpdateStatusLabel(StatusLabel, "Status: 1. Scanning Workspace... (Loot: "..lootProgress.." | Hop sau: "..timeRemaining.."s)")

            local fruits, chests = ScanWorkspace()
            UpdateStatusLabel(StatusLabel, "Status: 2. Collecting " .. tostring(#fruits) .. " Fruits (Ưu tiên)...")
            CollectFruits(fruits)

            UpdateStatusLabel(StatusLabel, "Status: 3. Collecting " .. tostring(#chests) .. " Chests/Checking Hop Conditions...")
            CollectChests(chests)

            if (tick() - lastHopTime) >= Config.HopInterval or getgenv().LootCounter >= Config.MaxLootBeforeHop then
                Notify("Auto-Hop", "Đã đạt giới hạn Loot/Thời gian. Tự động đổi Server.")
                UpdateStatusLabel(StatusLabel, "Status: 5. Đã đạt giới hạn. Đang Hop Server...")
                getgenv().LootCounter = 0
                pcall(HopToNextServer)
                return
            end

            if getgenv().LootCounter >= Config.LootCountBeforeReset then
                UpdateStatusLabel(StatusLabel, "Status: 4. Reached small loot limit. Resetting character...")
                Notify("Auto-Loot", "Đã loot " .. tostring(getgenv().LootCounter) .. " items. Thực hiện Reset.")
                pcall(SmartReset)
                getgenv().LootCounter = 0
                task.wait(1)
            end

            task.wait(math.random(1.5, 2.5))
        end
    end
end)

-- End of script
Log.info("Script loaded successfully.")
