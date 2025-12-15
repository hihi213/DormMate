{
  "openapi": "3.0.1",
  "info": {
    "title": "OpenAPI definition",
    "version": "v0"
  },
  "servers": [
    {
      "url": "http://localhost:8080",
      "description": "Generated server url"
    }
  ],
  "paths": {
    "/admin/policies": {
      "get": {
        "tags": [
          "admin-dashboard-controller"
        ],
        "operationId": "getPolicies",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/AdminPoliciesResponse"
                }
              }
            }
          }
        }
      },
      "put": {
        "tags": [
          "admin-dashboard-controller"
        ],
        "operationId": "updatePolicies",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateAdminPoliciesRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/fridge/inspections": {
      "get": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "listSessions",
        "parameters": [
          {
            "name": "slotId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/InspectionSessionResponse"
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "startSession",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/StartInspectionRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionSessionResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/inspections/{sessionId}/submit": {
      "post": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "submitSession",
        "parameters": [
          {
            "name": "sessionId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/SubmitInspectionRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionSessionResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/inspections/{sessionId}/actions": {
      "post": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "recordActions",
        "parameters": [
          {
            "name": "sessionId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/InspectionActionRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionSessionResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/inspection-schedules": {
      "get": {
        "tags": [
          "inspection-schedule-controller"
        ],
        "operationId": "listSchedules",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          },
          {
            "name": "floor",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          },
          {
            "name": "compartmentId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "array",
              "items": {
                "type": "string",
                "format": "uuid"
              }
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/InspectionScheduleResponse"
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "inspection-schedule-controller"
        ],
        "operationId": "createSchedule",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateInspectionScheduleRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionScheduleResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/bundles": {
      "get": {
        "tags": [
          "fridge-controller"
        ],
        "operationId": "getBundles",
        "parameters": [
          {
            "name": "slotId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "name": "owner",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 0
            }
          },
          {
            "name": "size",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/BundleListResponse"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "fridge-controller"
        ],
        "summary": "포장 생성",
        "description": "배정된 칸에 새로운 포장을 추가한다. 허용량(`capacity`)을 초과하면 422 `CAPACITY_EXCEEDED`가 반환된다. 데모 시나리오에서는 2층 A칸(`slotIndex` 0)만 설명용으로 허용량이 3으로 제한돼 있다.\n",
        "operationId": "createBundle",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateBundleRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "201": {
            "description": "포장 생성 성공",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/CreateBundleResponse"
                }
              }
            }
          },
          "422": {
            "description": "허용량 초과 – detail 값이 `CAPACITY_EXCEEDED`",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/CreateBundleResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/bundles/{bundleId}/items": {
      "post": {
        "tags": [
          "fridge-controller"
        ],
        "operationId": "addItem",
        "parameters": [
          {
            "name": "bundleId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AddItemRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeItemResponse"
                }
              }
            }
          }
        }
      }
    },
    "/auth/refresh": {
      "post": {
        "tags": [
          "auth-controller"
        ],
        "operationId": "refresh",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RefreshRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/LoginResponse"
                }
              }
            }
          }
        }
      }
    },
    "/auth/logout": {
      "post": {
        "tags": [
          "auth-controller"
        ],
        "operationId": "logout",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LogoutRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/auth/login": {
      "post": {
        "tags": [
          "auth-controller"
        ],
        "operationId": "login",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LoginRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/LoginResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/users/{userId}/roles/floor-manager": {
      "post": {
        "tags": [
          "admin-dashboard-controller"
        ],
        "operationId": "promoteFloorManager",
        "parameters": [
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RoleChangeRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      },
      "delete": {
        "tags": [
          "admin-dashboard-controller"
        ],
        "operationId": "demoteFloorManager",
        "parameters": [
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RoleChangeRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/admin/seed/fridge-demo": {
      "post": {
        "tags": [
          "demo-seed-controller"
        ],
        "summary": "데모 데이터 초기화",
        "description": "관리자가 냉장고 데모 데이터를 초기화한다.",
        "operationId": "seedFridgeDemo",
        "responses": {
          "200": {
            "description": "초기화 성공",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/SeedResponse"
                }
              }
            }
          },
          "403": {
            "description": "관리자 권한 필요",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/SeedResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/fridge/reallocations/preview": {
      "post": {
        "tags": [
          "fridge-admin-reallocation-controller"
        ],
        "operationId": "preview",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ReallocationPreviewRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/ReallocationPreviewResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/fridge/reallocations/apply": {
      "post": {
        "tags": [
          "fridge-admin-reallocation-controller"
        ],
        "operationId": "apply",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ReallocationApplyRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/ReallocationApplyResponse"
                }
              }
            }
          }
        }
      }
    },
    "/notifications/{notificationId}/read": {
      "patch": {
        "tags": [
          "notification-controller"
        ],
        "operationId": "markRead",
        "parameters": [
          {
            "name": "notificationId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/notifications/read-all": {
      "patch": {
        "tags": [
          "notification-controller"
        ],
        "operationId": "markAllRead",
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/notifications/preferences/{kindCode}": {
      "patch": {
        "tags": [
          "notification-controller"
        ],
        "operationId": "updatePreference",
        "parameters": [
          {
            "name": "kindCode",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateNotificationPreferenceRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/NotificationPreferenceItemResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/items/{itemId}": {
      "delete": {
        "tags": [
          "fridge-controller"
        ],
        "operationId": "deleteItem",
        "parameters": [
          {
            "name": "itemId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      },
      "patch": {
        "tags": [
          "fridge-controller"
        ],
        "operationId": "updateItem",
        "parameters": [
          {
            "name": "itemId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateItemRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeItemResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/inspections/{sessionId}": {
      "get": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "getSession",
        "parameters": [
          {
            "name": "sessionId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionSessionResponse"
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "cancelSession",
        "parameters": [
          {
            "name": "sessionId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      },
      "patch": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "updateSession",
        "parameters": [
          {
            "name": "sessionId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateInspectionSessionRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionSessionResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/inspection-schedules/{scheduleId}": {
      "delete": {
        "tags": [
          "inspection-schedule-controller"
        ],
        "operationId": "deleteSchedule",
        "parameters": [
          {
            "name": "scheduleId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      },
      "patch": {
        "tags": [
          "inspection-schedule-controller"
        ],
        "operationId": "updateSchedule",
        "parameters": [
          {
            "name": "scheduleId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateInspectionScheduleRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionScheduleResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/bundles/{bundleId}": {
      "get": {
        "tags": [
          "fridge-controller"
        ],
        "operationId": "getBundle",
        "parameters": [
          {
            "name": "bundleId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeBundleResponse"
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "fridge-controller"
        ],
        "operationId": "deleteBundle",
        "parameters": [
          {
            "name": "bundleId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      },
      "patch": {
        "tags": [
          "fridge-controller"
        ],
        "operationId": "updateBundle",
        "parameters": [
          {
            "name": "bundleId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateBundleRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeBundleResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/users/{userId}/status": {
      "patch": {
        "tags": [
          "admin-dashboard-controller"
        ],
        "operationId": "updateUserStatus",
        "parameters": [
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateUserStatusRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/admin/fridge/compartments/{compartmentId}": {
      "patch": {
        "tags": [
          "fridge-admin-controller"
        ],
        "summary": "냉장고 칸 설정 수정",
        "description": "관리자가 특정 칸의 허용량과 상태를 조정한다.",
        "operationId": "updateCompartment",
        "parameters": [
          {
            "name": "compartmentId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateCompartmentConfigRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "409": {
            "description": "검사 세션 진행 중",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeSlotResponse"
                }
              }
            }
          },
          "200": {
            "description": "수정 성공",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeSlotResponse"
                }
              }
            }
          },
          "403": {
            "description": "관리자 권한 필요",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeSlotResponse"
                }
              }
            }
          },
          "404": {
            "description": "대상 칸 없음",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeSlotResponse"
                }
              }
            }
          },
          "422": {
            "description": "현재 활성 포장 수보다 낮은 용량으로 설정 시",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeSlotResponse"
                }
              }
            }
          }
        }
      }
    },
    "/readyz": {
      "get": {
        "tags": [
          "health-controller"
        ],
        "operationId": "readyz",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResponse"
                }
              }
            }
          }
        }
      }
    },
    "/profile/me": {
      "get": {
        "tags": [
          "profile-controller"
        ],
        "operationId": "currentUser",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/UserProfileResponse"
                }
              }
            }
          }
        }
      }
    },
    "/notifications": {
      "get": {
        "tags": [
          "notification-controller"
        ],
        "operationId": "getNotifications",
        "parameters": [
          {
            "name": "state",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "all"
            }
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 0
            }
          },
          {
            "name": "size",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/NotificationListResponse"
                }
              }
            }
          }
        }
      }
    },
    "/notifications/preferences": {
      "get": {
        "tags": [
          "notification-controller"
        ],
        "operationId": "getPreferences",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/NotificationPreferenceResponse"
                }
              }
            }
          }
        }
      }
    },
    "/healthz": {
      "get": {
        "tags": [
          "health-controller"
        ],
        "operationId": "healthz",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResponse"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      "get": {
        "tags": [
          "health-controller"
        ],
        "operationId": "health",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/HealthResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/slots": {
      "get": {
        "tags": [
          "fridge-controller"
        ],
        "operationId": "getSlots",
        "parameters": [
          {
            "name": "floor",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          },
          {
            "name": "view",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          },
          {
            "name": "size",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/FridgeSlotListResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/inspections/active": {
      "get": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "getActiveSession",
        "parameters": [
          {
            "name": "floor",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionSessionResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/inspection-schedules/next": {
      "get": {
        "tags": [
          "inspection-schedule-controller"
        ],
        "operationId": "getNextSchedule",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionScheduleResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/users": {
      "get": {
        "tags": [
          "admin-dashboard-controller"
        ],
        "operationId": "getUsers",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "default": "ACTIVE"
            }
          },
          {
            "name": "floor",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "floorManagerOnly",
            "in": "query",
            "required": false,
            "schema": {
              "type": "boolean",
              "default": false
            }
          },
          {
            "name": "search",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 0
            }
          },
          {
            "name": "size",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/AdminUsersResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/fridge/issues": {
      "get": {
        "tags": [
          "admin-dashboard-controller"
        ],
        "operationId": "getFridgeOwnershipIssues",
        "parameters": [
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 0
            }
          },
          {
            "name": "size",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 20
            }
          },
          {
            "name": "ownerId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/AdminFridgeOwnershipIssuesResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/fridge/compartments": {
      "get": {
        "tags": [
          "fridge-admin-controller"
        ],
        "summary": "냉장고 칸 메타데이터 조회",
        "description": "관리자가 층별 칸 정보를 확인한다.",
        "operationId": "listCompartments",
        "parameters": [
          {
            "name": "floor",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          },
          {
            "name": "view",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "403": {
            "description": "관리자 권한 필요",
            "content": {
              "*/*": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/FridgeSlotResponse"
                  }
                }
              }
            }
          },
          "200": {
            "description": "조회 성공",
            "content": {
              "*/*": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/FridgeSlotResponse"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/admin/fridge/bundles/deleted": {
      "get": {
        "tags": [
          "fridge-admin-bundle-controller"
        ],
        "operationId": "getDeletedBundles",
        "parameters": [
          {
            "name": "since",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            }
          },
          {
            "name": "slotId",
            "in": "query",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "name": "page",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 0
            }
          },
          {
            "name": "size",
            "in": "query",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32",
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/BundleListResponse"
                }
              }
            }
          }
        }
      }
    },
    "/admin/dashboard": {
      "get": {
        "tags": [
          "admin-dashboard-controller"
        ],
        "operationId": "getDashboard",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/AdminDashboardResponse"
                }
              }
            }
          }
        }
      }
    },
    "/fridge/inspections/{sessionId}/actions/{actionId}": {
      "delete": {
        "tags": [
          "inspection-controller"
        ],
        "operationId": "deleteAction",
        "parameters": [
          {
            "name": "sessionId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "name": "actionId",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "format": "int64"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/InspectionSessionResponse"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "NotificationPolicy": {
        "required": [
          "batchTime"
        ],
        "type": "object",
        "properties": {
          "batchTime": {
            "pattern": "^\\d{2}:\\d{2}$",
            "type": "string"
          },
          "dailyLimit": {
            "minimum": 0,
            "type": "integer",
            "format": "int32"
          },
          "ttlHours": {
            "minimum": 1,
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "PenaltyPolicy": {
        "required": [
          "template"
        ],
        "type": "object",
        "properties": {
          "limit": {
            "minimum": 0,
            "type": "integer",
            "format": "int32"
          },
          "template": {
            "type": "string"
          }
        }
      },
      "UpdateAdminPoliciesRequest": {
        "required": [
          "notification",
          "penalty"
        ],
        "type": "object",
        "properties": {
          "notification": {
            "$ref": "#/components/schemas/NotificationPolicy"
          },
          "penalty": {
            "$ref": "#/components/schemas/PenaltyPolicy"
          }
        }
      },
      "StartInspectionRequest": {
        "required": [
          "slotId"
        ],
        "type": "object",
        "properties": {
          "slotId": {
            "type": "string",
            "format": "uuid"
          },
          "scheduleId": {
            "type": "string",
            "format": "uuid"
          }
        }
      },
      "FridgeBundleResponse": {
        "type": "object",
        "properties": {
          "bundleId": {
            "type": "string",
            "format": "uuid"
          },
          "slotId": {
            "type": "string",
            "format": "uuid"
          },
          "slotIndex": {
            "type": "integer",
            "format": "int32"
          },
          "slotLabel": {
            "type": "string"
          },
          "labelNumber": {
            "type": "integer",
            "format": "int32"
          },
          "labelDisplay": {
            "type": "string"
          },
          "bundleName": {
            "type": "string"
          },
          "memo": {
            "type": "string"
          },
          "ownerUserId": {
            "type": "string",
            "format": "uuid"
          },
          "ownerDisplayName": {
            "type": "string"
          },
          "ownerRoomNumber": {
            "type": "string"
          },
          "status": {
            "type": "string"
          },
          "freshness": {
            "type": "string"
          },
          "itemCount": {
            "type": "integer",
            "format": "int32"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "removedAt": {
            "type": "string",
            "format": "date-time"
          },
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FridgeItemResponse"
            }
          }
        }
      },
      "FridgeItemResponse": {
        "type": "object",
        "properties": {
          "itemId": {
            "type": "string",
            "format": "uuid"
          },
          "bundleId": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "expiryDate": {
            "type": "string",
            "format": "date"
          },
          "quantity": {
            "type": "integer",
            "format": "int32"
          },
          "unitCode": {
            "type": "string"
          },
          "freshness": {
            "type": "string"
          },
          "lastInspectedAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAfterInspection": {
            "type": "boolean"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "removedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "InspectionActionDetailResponse": {
        "type": "object",
        "properties": {
          "actionId": {
            "type": "integer",
            "format": "int64"
          },
          "actionType": {
            "type": "string"
          },
          "bundleId": {
            "type": "string",
            "format": "uuid"
          },
          "targetUserId": {
            "type": "string",
            "format": "uuid"
          },
          "recordedAt": {
            "type": "string",
            "format": "date-time"
          },
          "recordedBy": {
            "type": "string",
            "format": "uuid"
          },
          "recordedByLogin": {
            "type": "string"
          },
          "recordedByName": {
            "type": "string"
          },
          "note": {
            "type": "string"
          },
          "correlationId": {
            "type": "string",
            "format": "uuid"
          },
          "roomNumber": {
            "type": "string"
          },
          "personalNo": {
            "type": "integer",
            "format": "int32"
          },
          "targetName": {
            "type": "string"
          },
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/InspectionActionItemResponse"
            }
          },
          "penalties": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/PenaltyHistoryResponse"
            }
          }
        }
      },
      "InspectionActionItemResponse": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "format": "int64"
          },
          "fridgeItemId": {
            "type": "string",
            "format": "uuid"
          },
          "snapshotName": {
            "type": "string"
          },
          "snapshotExpiresOn": {
            "type": "string",
            "format": "date"
          },
          "quantityAtAction": {
            "type": "integer",
            "format": "int32"
          },
          "correlationId": {
            "type": "string",
            "format": "uuid"
          }
        }
      },
      "InspectionActionSummaryResponse": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string"
          },
          "count": {
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "InspectionSessionResponse": {
        "type": "object",
        "properties": {
          "sessionId": {
            "type": "string",
            "format": "uuid"
          },
          "slotId": {
            "type": "string",
            "format": "uuid"
          },
          "slotIndex": {
            "type": "integer",
            "format": "int32"
          },
          "slotLabel": {
            "type": "string"
          },
          "floorNo": {
            "type": "integer",
            "format": "int32"
          },
          "floorCode": {
            "type": "string"
          },
          "status": {
            "type": "string"
          },
          "startedBy": {
            "type": "string",
            "format": "uuid"
          },
          "startedByLogin": {
            "type": "string"
          },
          "startedByName": {
            "type": "string"
          },
          "startedByRoomNumber": {
            "type": "string"
          },
          "startedByPersonalNo": {
            "type": "integer",
            "format": "int32"
          },
          "startedAt": {
            "type": "string",
            "format": "date-time"
          },
          "endedAt": {
            "type": "string",
            "format": "date-time"
          },
          "bundles": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FridgeBundleResponse"
            }
          },
          "summary": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/InspectionActionSummaryResponse"
            }
          },
          "actions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/InspectionActionDetailResponse"
            }
          },
          "notes": {
            "type": "string"
          },
          "initialBundleCount": {
            "type": "integer",
            "format": "int32"
          },
          "totalBundleCount": {
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "PenaltyHistoryResponse": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "points": {
            "type": "integer",
            "format": "int32"
          },
          "reason": {
            "type": "string"
          },
          "issuedAt": {
            "type": "string",
            "format": "date-time"
          },
          "expiresAt": {
            "type": "string",
            "format": "date-time"
          },
          "correlationId": {
            "type": "string",
            "format": "uuid"
          }
        }
      },
      "SubmitInspectionRequest": {
        "type": "object",
        "properties": {
          "notes": {
            "type": "string"
          }
        }
      },
      "InspectionActionEntryRequest": {
        "required": [
          "action"
        ],
        "type": "object",
        "properties": {
          "bundleId": {
            "type": "string",
            "format": "uuid"
          },
          "itemId": {
            "type": "string",
            "format": "uuid"
          },
          "action": {
            "type": "string"
          },
          "note": {
            "type": "string"
          }
        }
      },
      "InspectionActionRequest": {
        "required": [
          "actions"
        ],
        "type": "object",
        "properties": {
          "actions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/InspectionActionEntryRequest"
            }
          }
        }
      },
      "CreateInspectionScheduleRequest": {
        "required": [
          "fridgeCompartmentId",
          "scheduledAt"
        ],
        "type": "object",
        "properties": {
          "scheduledAt": {
            "type": "string",
            "format": "date-time"
          },
          "title": {
            "maxLength": 120,
            "minLength": 0,
            "type": "string"
          },
          "notes": {
            "type": "string"
          },
          "fridgeCompartmentId": {
            "type": "string",
            "format": "uuid"
          }
        }
      },
      "InspectionScheduleResponse": {
        "type": "object",
        "properties": {
          "scheduleId": {
            "type": "string",
            "format": "uuid"
          },
          "scheduledAt": {
            "type": "string",
            "format": "date-time"
          },
          "title": {
            "type": "string"
          },
          "notes": {
            "type": "string"
          },
          "status": {
            "type": "string"
          },
          "completedAt": {
            "type": "string",
            "format": "date-time"
          },
          "inspectionSessionId": {
            "type": "string",
            "format": "uuid"
          },
          "fridgeCompartmentId": {
            "type": "string",
            "format": "uuid"
          },
          "slotIndex": {
            "type": "integer",
            "format": "int32"
          },
          "slotLetter": {
            "type": "string"
          },
          "floorNo": {
            "type": "integer",
            "format": "int32"
          },
          "floorCode": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "CreateBundleItemInput": {
        "required": [
          "expiryDate",
          "name"
        ],
        "type": "object",
        "properties": {
          "name": {
            "maxLength": 120,
            "minLength": 0,
            "type": "string"
          },
          "expiryDate": {
            "type": "string",
            "format": "date"
          },
          "quantity": {
            "minimum": 1,
            "type": "integer",
            "format": "int32"
          },
          "unitCode": {
            "type": "string"
          }
        }
      },
      "CreateBundleRequest": {
        "required": [
          "bundleName",
          "items",
          "slotId"
        ],
        "type": "object",
        "properties": {
          "slotId": {
            "type": "string",
            "format": "uuid"
          },
          "bundleName": {
            "maxLength": 120,
            "minLength": 0,
            "type": "string"
          },
          "memo": {
            "type": "string"
          },
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CreateBundleItemInput"
            }
          }
        }
      },
      "CreateBundleResponse": {
        "type": "object",
        "properties": {
          "bundle": {
            "$ref": "#/components/schemas/FridgeBundleResponse"
          }
        }
      },
      "AddItemRequest": {
        "required": [
          "expiryDate",
          "name"
        ],
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "expiryDate": {
            "type": "string",
            "format": "date"
          },
          "quantity": {
            "minimum": 1,
            "type": "integer",
            "format": "int32"
          },
          "unitCode": {
            "type": "string"
          }
        }
      },
      "RefreshRequest": {
        "required": [
          "deviceId",
          "refreshToken"
        ],
        "type": "object",
        "properties": {
          "refreshToken": {
            "type": "string"
          },
          "deviceId": {
            "type": "string"
          }
        }
      },
      "LoginResponse": {
        "type": "object",
        "properties": {
          "tokens": {
            "$ref": "#/components/schemas/TokenPairResponse"
          },
          "user": {
            "$ref": "#/components/schemas/UserProfileResponse"
          }
        }
      },
      "RoomAssignmentResponse": {
        "type": "object",
        "properties": {
          "roomId": {
            "type": "string",
            "format": "uuid"
          },
          "floor": {
            "type": "integer",
            "format": "int32"
          },
          "roomNumber": {
            "type": "string"
          },
          "personalNo": {
            "type": "integer",
            "format": "int32"
          },
          "assignedAt": {
            "type": "string",
            "format": "date-time"
          },
          "floorCode": {
            "type": "string"
          }
        }
      },
      "TokenPairResponse": {
        "type": "object",
        "properties": {
          "accessToken": {
            "type": "string"
          },
          "tokenType": {
            "type": "string"
          },
          "expiresIn": {
            "type": "integer",
            "format": "int64"
          },
          "refreshToken": {
            "type": "string"
          },
          "refreshExpiresIn": {
            "type": "integer",
            "format": "int64"
          },
          "issuedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "UserProfileResponse": {
        "type": "object",
        "properties": {
          "userId": {
            "type": "string",
            "format": "uuid"
          },
          "loginId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "email": {
            "type": "string"
          },
          "roles": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "primaryRoom": {
            "$ref": "#/components/schemas/RoomAssignmentResponse"
          },
          "isFloorManager": {
            "type": "boolean"
          },
          "isAdmin": {
            "type": "boolean"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "LogoutRequest": {
        "required": [
          "refreshToken"
        ],
        "type": "object",
        "properties": {
          "refreshToken": {
            "type": "string"
          }
        }
      },
      "LoginRequest": {
        "required": [
          "deviceId",
          "loginId",
          "password"
        ],
        "type": "object",
        "properties": {
          "loginId": {
            "type": "string"
          },
          "password": {
            "type": "string"
          },
          "deviceId": {
            "type": "string"
          }
        }
      },
      "RoleChangeRequest": {
        "required": [
          "reason"
        ],
        "type": "object",
        "properties": {
          "reason": {
            "maxLength": 200,
            "minLength": 2,
            "type": "string"
          }
        }
      },
      "SeedResponse": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string"
          },
          "executedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "ReallocationPreviewRequest": {
        "type": "object",
        "properties": {
          "floor": {
            "minimum": 1,
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "CompartmentAllocationView": {
        "type": "object",
        "properties": {
          "compartmentId": {
            "type": "string",
            "format": "uuid"
          },
          "fridgeUnitId": {
            "type": "string",
            "format": "uuid"
          },
          "slotIndex": {
            "type": "integer",
            "format": "int32"
          },
          "slotLabel": {
            "type": "string"
          },
          "compartmentType": {
            "type": "string",
            "enum": [
              "CHILL",
              "FREEZE"
            ]
          },
          "status": {
            "type": "string",
            "enum": [
              "ACTIVE",
              "SUSPENDED",
              "REPORTED",
              "RETIRED"
            ]
          },
          "locked": {
            "type": "boolean"
          },
          "currentRoomIds": {
            "type": "array",
            "items": {
              "type": "string",
              "format": "uuid"
            }
          },
          "recommendedRoomIds": {
            "type": "array",
            "items": {
              "type": "string",
              "format": "uuid"
            }
          },
          "warnings": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      },
      "ReallocationPreviewResponse": {
        "type": "object",
        "properties": {
          "floor": {
            "type": "integer",
            "format": "int32"
          },
          "rooms": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/RoomSummary"
            }
          },
          "allocations": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CompartmentAllocationView"
            }
          },
          "chillCompartmentCount": {
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "RoomSummary": {
        "type": "object",
        "properties": {
          "roomId": {
            "type": "string",
            "format": "uuid"
          },
          "roomNumber": {
            "type": "string"
          },
          "roomType": {
            "type": "string"
          },
          "floor": {
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "CompartmentAllocationInput": {
        "required": [
          "compartmentId",
          "roomIds"
        ],
        "type": "object",
        "properties": {
          "compartmentId": {
            "type": "string",
            "format": "uuid"
          },
          "roomIds": {
            "type": "array",
            "items": {
              "type": "string",
              "format": "uuid"
            }
          }
        }
      },
      "ReallocationApplyRequest": {
        "required": [
          "allocations"
        ],
        "type": "object",
        "properties": {
          "floor": {
            "minimum": 1,
            "type": "integer",
            "format": "int32"
          },
          "allocations": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CompartmentAllocationInput"
            }
          }
        }
      },
      "ReallocationApplyResponse": {
        "type": "object",
        "properties": {
          "floor": {
            "type": "integer",
            "format": "int32"
          },
          "affectedCompartments": {
            "type": "integer",
            "format": "int32"
          },
          "releasedAssignments": {
            "type": "integer",
            "format": "int32"
          },
          "createdAssignments": {
            "type": "integer",
            "format": "int32"
          },
          "appliedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "UpdateNotificationPreferenceRequest": {
        "required": [
          "allowBackground",
          "enabled"
        ],
        "type": "object",
        "properties": {
          "enabled": {
            "type": "boolean"
          },
          "allowBackground": {
            "type": "boolean"
          }
        }
      },
      "NotificationPreferenceItemResponse": {
        "type": "object",
        "properties": {
          "kindCode": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "enabled": {
            "type": "boolean"
          },
          "allowBackground": {
            "type": "boolean"
          }
        }
      },
      "UpdateItemRequest": {
        "type": "object",
        "properties": {
          "name": {
            "maxLength": 120,
            "minLength": 1,
            "type": "string"
          },
          "expiryDate": {
            "type": "string",
            "format": "date"
          },
          "quantity": {
            "minimum": 1,
            "type": "integer",
            "format": "int32"
          },
          "unitCode": {
            "type": "string"
          },
          "removedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "InspectionActionMutationRequest": {
        "required": [
          "action"
        ],
        "type": "object",
        "properties": {
          "actionId": {
            "type": "integer",
            "format": "int64"
          },
          "bundleId": {
            "type": "string",
            "format": "uuid"
          },
          "itemId": {
            "type": "string",
            "format": "uuid"
          },
          "action": {
            "type": "string"
          },
          "note": {
            "type": "string"
          }
        }
      },
      "UpdateInspectionSessionRequest": {
        "type": "object",
        "properties": {
          "notes": {
            "type": "string"
          },
          "mutations": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/InspectionActionMutationRequest"
            }
          },
          "deleteActionIds": {
            "type": "array",
            "items": {
              "type": "integer",
              "format": "int64"
            }
          }
        }
      },
      "UpdateInspectionScheduleRequest": {
        "type": "object",
        "properties": {
          "scheduledAt": {
            "type": "string",
            "format": "date-time"
          },
          "title": {
            "maxLength": 120,
            "minLength": 0,
            "type": "string"
          },
          "notes": {
            "type": "string"
          },
          "status": {
            "type": "string"
          },
          "completedAt": {
            "type": "string",
            "format": "date-time"
          },
          "inspectionSessionId": {
            "type": "string",
            "format": "uuid"
          },
          "detachInspectionSession": {
            "type": "boolean"
          },
          "fridgeCompartmentId": {
            "type": "string",
            "format": "uuid"
          }
        }
      },
      "UpdateBundleRequest": {
        "type": "object",
        "properties": {
          "bundleName": {
            "maxLength": 120,
            "minLength": 1,
            "type": "string"
          },
          "memo": {
            "type": "string"
          },
          "removedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "UpdateUserStatusRequest": {
        "required": [
          "reason",
          "status"
        ],
        "type": "object",
        "properties": {
          "status": {
            "type": "string"
          },
          "reason": {
            "maxLength": 200,
            "minLength": 2,
            "type": "string"
          }
        }
      },
      "UpdateCompartmentConfigRequest": {
        "type": "object",
        "properties": {
          "maxBundleCount": {
            "minimum": 1,
            "type": "integer",
            "format": "int32"
          },
          "status": {
            "type": "string"
          }
        }
      },
      "FridgeSlotResponse": {
        "type": "object",
        "properties": {
          "slotId": {
            "type": "string",
            "format": "uuid"
          },
          "slotIndex": {
            "type": "integer",
            "format": "int32"
          },
          "slotLetter": {
            "type": "string"
          },
          "floorNo": {
            "type": "integer",
            "format": "int32"
          },
          "floorCode": {
            "type": "string"
          },
          "compartmentType": {
            "type": "string"
          },
          "resourceStatus": {
            "type": "string"
          },
          "slotStatus": {
            "type": "string",
            "enum": [
              "ACTIVE",
              "LOCKED",
              "IN_INSPECTION"
            ]
          },
          "locked": {
            "type": "boolean"
          },
          "lockedUntil": {
            "type": "string",
            "format": "date-time"
          },
          "capacity": {
            "type": "integer",
            "format": "int32"
          },
          "displayName": {
            "type": "string"
          },
          "occupiedCount": {
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "HealthResponse": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string"
          },
          "timestamp": {
            "type": "string"
          }
        }
      },
      "NotificationItemResponse": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "kindCode": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "body": {
            "type": "string"
          },
          "state": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "readAt": {
            "type": "string",
            "format": "date-time"
          },
          "ttlAt": {
            "type": "string",
            "format": "date-time"
          },
          "correlationId": {
            "type": "string",
            "format": "uuid"
          },
          "metadata": {
            "type": "object",
            "additionalProperties": {
              "type": "object"
            }
          }
        }
      },
      "NotificationListResponse": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/NotificationItemResponse"
            }
          },
          "page": {
            "type": "integer",
            "format": "int32"
          },
          "size": {
            "type": "integer",
            "format": "int32"
          },
          "totalElements": {
            "type": "integer",
            "format": "int64"
          },
          "unreadCount": {
            "type": "integer",
            "format": "int64"
          }
        }
      },
      "NotificationPreferenceResponse": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/NotificationPreferenceItemResponse"
            }
          }
        }
      },
      "FridgeSlotListResponse": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FridgeSlotResponse"
            }
          },
          "totalCount": {
            "type": "integer",
            "format": "int64"
          },
          "page": {
            "type": "integer",
            "format": "int32"
          },
          "size": {
            "type": "integer",
            "format": "int32"
          },
          "totalPages": {
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "BundleListResponse": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FridgeBundleSummaryResponse"
            }
          },
          "totalCount": {
            "type": "integer",
            "format": "int64"
          }
        }
      },
      "FridgeBundleSummaryResponse": {
        "type": "object",
        "properties": {
          "bundleId": {
            "type": "string",
            "format": "uuid"
          },
          "slotId": {
            "type": "string",
            "format": "uuid"
          },
          "slotIndex": {
            "type": "integer",
            "format": "int32"
          },
          "slotLabel": {
            "type": "string"
          },
          "labelNumber": {
            "type": "integer",
            "format": "int32"
          },
          "labelDisplay": {
            "type": "string"
          },
          "bundleName": {
            "type": "string"
          },
          "memo": {
            "type": "string"
          },
          "ownerUserId": {
            "type": "string",
            "format": "uuid"
          },
          "ownerDisplayName": {
            "type": "string"
          },
          "ownerRoomNumber": {
            "type": "string"
          },
          "status": {
            "type": "string"
          },
          "freshness": {
            "type": "string"
          },
          "itemCount": {
            "type": "integer",
            "format": "int32"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "removedAt": {
            "type": "string",
            "format": "date-time"
          },
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/FridgeItemResponse"
            }
          }
        }
      },
      "AdminUsersResponse": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/User"
            }
          },
          "page": {
            "type": "integer",
            "format": "int32"
          },
          "size": {
            "type": "integer",
            "format": "int32"
          },
          "totalElements": {
            "type": "integer",
            "format": "int64"
          },
          "totalPages": {
            "type": "integer",
            "format": "int32"
          },
          "availableFloors": {
            "type": "array",
            "items": {
              "type": "integer",
              "format": "int32"
            }
          }
        }
      },
      "PenaltyRecord": {
        "type": "object",
        "properties": {
          "module": {
            "type": "string"
          },
          "source": {
            "type": "string"
          },
          "points": {
            "type": "integer",
            "format": "int32"
          },
          "reason": {
            "type": "string"
          },
          "issuedAt": {
            "type": "string"
          }
        }
      },
      "User": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "room": {
            "type": "string"
          },
          "floor": {
            "type": "integer",
            "format": "int32"
          },
          "roomCode": {
            "type": "string"
          },
          "personalNo": {
            "type": "integer",
            "format": "int32"
          },
          "role": {
            "type": "string"
          },
          "roles": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "status": {
            "type": "string"
          },
          "lastLogin": {
            "type": "string"
          },
          "penalties": {
            "type": "integer",
            "format": "int32"
          },
          "penaltyRecords": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/PenaltyRecord"
            }
          }
        }
      },
      "AdminPoliciesResponse": {
        "type": "object",
        "properties": {
          "notification": {
            "$ref": "#/components/schemas/NotificationPolicy"
          },
          "penalty": {
            "$ref": "#/components/schemas/PenaltyPolicy"
          }
        }
      },
      "AdminFridgeOwnershipIssuesResponse": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Issue"
            }
          },
          "page": {
            "type": "integer",
            "format": "int32"
          },
          "size": {
            "type": "integer",
            "format": "int32"
          },
          "totalElements": {
            "type": "integer",
            "format": "int64"
          },
          "totalPages": {
            "type": "integer",
            "format": "int32"
          }
        }
      },
      "Issue": {
        "type": "object",
        "properties": {
          "bundleId": {
            "type": "string",
            "format": "uuid"
          },
          "bundleName": {
            "type": "string"
          },
          "labelNumber": {
            "type": "integer",
            "format": "int32"
          },
          "ownerUserId": {
            "type": "string",
            "format": "uuid"
          },
          "ownerName": {
            "type": "string"
          },
          "ownerLoginId": {
            "type": "string"
          },
          "roomId": {
            "type": "string",
            "format": "uuid"
          },
          "roomNumber": {
            "type": "string"
          },
          "roomFloor": {
            "type": "integer",
            "format": "int32"
          },
          "personalNo": {
            "type": "integer",
            "format": "int32"
          },
          "fridgeCompartmentId": {
            "type": "string",
            "format": "uuid"
          },
          "slotIndex": {
            "type": "integer",
            "format": "int32"
          },
          "compartmentType": {
            "type": "string"
          },
          "fridgeFloorNo": {
            "type": "integer",
            "format": "int32"
          },
          "fridgeDisplayName": {
            "type": "string"
          },
          "issueType": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "AdminDashboardResponse": {
        "type": "object",
        "properties": {
          "summary": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SummaryCard"
            }
          },
          "timeline": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/TimelineEvent"
            }
          },
          "quickActions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/QuickAction"
            }
          }
        }
      },
      "QuickAction": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "href": {
            "type": "string"
          },
          "icon": {
            "type": "string"
          }
        }
      },
      "SummaryCard": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "value": {
            "type": "string"
          },
          "description": {
            "type": "string"
          }
        }
      },
      "TimelineEvent": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "time": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "detail": {
            "type": "string"
          }
        }
      }
    }
  }
}
